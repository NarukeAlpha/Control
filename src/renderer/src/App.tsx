import {
  Bell,
  Bot,
  Building2,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Code2,
  ExternalLink,
  Eye,
  File as FileIcon,
  Folder,
  Gauge,
  GitBranch,
  GitFork,
  GitPullRequest,
  Home,
  Inbox,
  Lock,
  MoreHorizontal,
  PlayCircle,
  Plus,
  Search,
  Settings,
  ShieldCheck,
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
  { key: "home", label: "Home", icon: Home },
  { key: "repositories", label: "Repositories", icon: Code2 },
  { key: "organizations", label: "Organizations", icon: Building2 },
  { key: "mailbox", label: "Mailbox", icon: Inbox }
] as const;

const repoTabs: Array<{ key: RepositoryTab; label: string; icon: typeof Code2 }> = [
  { key: "code", label: "Code", icon: Code2 },
  { key: "issues", label: "Issues", icon: CircleDot },
  { key: "pulls", label: "Pull requests", icon: GitPullRequest },
  { key: "agents", label: "Agents", icon: Bot },
  { key: "actions", label: "Actions", icon: PlayCircle },
  { key: "wiki", label: "Wiki", icon: BookOpen },
  { key: "securityQuality", label: "Security and Quality", icon: Gauge }
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

function encodeRepositoryPath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

function repositoryEntryPath(repository: RepositoryDetail, entry: RepoEntry): string {
  const ref = encodeURIComponent(repository.defaultBranch ?? "HEAD");
  const entryKind = entry.type === "dir" ? "tree" : "blob";
  return repositoryPath(repository, `/${entryKind}/${ref}/${encodeRepositoryPath(entry.path)}`);
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

function displayRepositoryName(repository: RepositorySummary | RepositoryDetail, viewerLogin?: string | null): string {
  if (viewerLogin && repository.owner.toLowerCase() === viewerLogin.toLowerCase()) {
    return titleCaseRepositoryName(repository.name);
  }

  return repository.nameWithOwner;
}

function titleCaseRepositoryName(name: string): string {
  return name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => (part.length > 0 ? `${part.slice(0, 1).toUpperCase()}${part.slice(1)}` : part))
    .join(" ");
}

function repositoryActivityDate(repository: RepositorySummary): string | null {
  return repository.pushedAt ?? repository.updatedAt;
}

function sortRepositoriesByActivity(repositories: RepositorySummary[]): RepositorySummary[] {
  return [...repositories].sort((a, b) => {
    const aTime = new Date(repositoryActivityDate(a) ?? 0).getTime();
    const bTime = new Date(repositoryActivityDate(b) ?? 0).getTime();
    return bTime - aTime;
  });
}

const vscodeIconsVersion = "v12.17.0";
const vscodeIconsBaseUrl = `https://cdn.jsdelivr.net/gh/vscode-icons/vscode-icons@${vscodeIconsVersion}/icons`;

const folderIconNames: Record<string, string> = {
  ".github": "folder_type_github.svg",
  ".vscode": "folder_type_vscode.svg",
  docs: "folder_type_docs.svg",
  documentation: "folder_type_docs.svg",
  src: "folder_type_src.svg",
  source: "folder_type_src.svg",
  test: "folder_type_test.svg",
  tests: "folder_type_test.svg",
  lib: "folder_type_library.svg",
  packages: "folder_type_package.svg",
  scripts: "folder_type_tools.svg",
  assets: "folder_type_asset.svg"
};

const fileNameIconNames: Record<string, string> = {
  "package.json": "file_type_node.svg",
  "package-lock.json": "file_type_npm.svg",
  "pnpm-lock.yaml": "file_type_pnpm.svg",
  "yarn.lock": "file_type_yarn.svg",
  "bun.lockb": "file_type_bun.svg",
  "tsconfig.json": "file_type_tsconfig.svg",
  "vite.config.ts": "file_type_vite.svg",
  "vite.config.js": "file_type_vite.svg",
  "vitest.config.ts": "file_type_vitest.svg",
  "eslint.config.mjs": "file_type_eslint.svg",
  ".eslintrc": "file_type_eslint.svg",
  ".prettierrc": "file_type_prettier.svg",
  "prettier.config.cjs": "file_type_prettier.svg",
  "readme.md": "file_type_markdown.svg",
  "license": "file_type_license.svg",
  "license.txt": "file_type_license.svg",
  "cmakelists.txt": "file_type_cmake.svg",
  ".gitignore": "file_type_git.svg",
  dockerfile: "file_type_docker.svg"
};

const extensionIconNames: Record<string, string> = {
  ts: "file_type_typescript.svg",
  tsx: "file_type_reactts.svg",
  js: "file_type_js.svg",
  jsx: "file_type_reactjs.svg",
  mjs: "file_type_js.svg",
  cjs: "file_type_js.svg",
  json: "file_type_json.svg",
  css: "file_type_css.svg",
  scss: "file_type_scss.svg",
  html: "file_type_html.svg",
  md: "file_type_markdown.svg",
  yml: "file_type_yaml.svg",
  yaml: "file_type_yaml.svg",
  toml: "file_type_toml.svg",
  xml: "file_type_xml.svg",
  sh: "file_type_shell.svg",
  zsh: "file_type_shell.svg",
  py: "file_type_python.svg",
  rb: "file_type_ruby.svg",
  go: "file_type_go.svg",
  rs: "file_type_rust.svg",
  swift: "file_type_swift.svg",
  c: "file_type_c.svg",
  h: "file_type_c.svg",
  cpp: "file_type_cpp.svg",
  hpp: "file_type_cpp.svg",
  java: "file_type_java.svg",
  kt: "file_type_kotlin.svg",
  php: "file_type_php.svg",
  png: "file_type_image.svg",
  jpg: "file_type_image.svg",
  jpeg: "file_type_image.svg",
  gif: "file_type_image.svg",
  svg: "file_type_svg.svg",
  pdf: "file_type_pdf.svg",
  zip: "file_type_zip.svg"
};

function iconUrlForEntry(entry: RepoEntry): string {
  if (entry.type === "dir") {
    const folderIcon = folderIconNames[entry.name.toLowerCase()] ?? "default_folder.svg";
    return `${vscodeIconsBaseUrl}/${folderIcon}`;
  }

  const lowerName = entry.name.toLowerCase();
  const fileNameIcon = fileNameIconNames[lowerName];
  if (fileNameIcon) {
    return `${vscodeIconsBaseUrl}/${fileNameIcon}`;
  }

  const extension = lowerName.includes(".") ? lowerName.split(".").pop() : null;
  return `${vscodeIconsBaseUrl}/${extension ? (extensionIconNames[extension] ?? "default_file.svg") : "default_file.svg"}`;
}

function EntryIcon({ entry }: { entry: RepoEntry }): JSX.Element {
  const iconUrl = useMemo(() => iconUrlForEntry(entry), [entry]);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const failed = failedUrl === iconUrl;
  const loaded = loadedUrl === iconUrl;

  return (
    <span className="file-icon-wrap">
      {(!loaded || failed) && (entry.type === "dir" ? <Folder size={18} /> : <FileIcon size={17} />)}
      {!failed && (
        <img
          className={`file-type-icon ${loaded ? "loaded" : ""}`}
          src={iconUrl}
          alt=""
          aria-hidden="true"
          loading="lazy"
          onLoad={() => setLoadedUrl(iconUrl)}
          onError={() => setFailedUrl(iconUrl)}
        />
      )}
    </span>
  );
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
    case "mailbox":
      return "Mailbox";
    case "repositories":
      return "Repositories";
    case "organizations":
      return "Organizations";
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
  const goToRepository = useUiStore((state) => state.goToRepository);
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
    queryFn: () => api.github.listAccountIssues({ state: "open", limit: 30 }),
    enabled: route.kind === "home" || route.kind === "mailbox"
  });

  const accountPulls = useQuery({
    queryKey: ["account-pulls"],
    queryFn: () => api.github.listAccountPullRequests({ state: "open", limit: 30 }),
    enabled: route.kind === "home" || route.kind === "mailbox"
  });

  const isRepositoryRoute = route.kind === "repository";
  const activeRepositoryTab = isRepositoryRoute ? route.tab : "code";
  const effectiveRepository =
    (isRepositoryRoute ? route.nameWithOwner : selectedRepository) ??
    repositories.data?.[0]?.nameWithOwner ??
    "apple/swift";
  const [owner = "apple", repo = "swift"] = effectiveRepository.split("/");
  const hasRepositoryParts = Boolean(owner && repo);

  const repository = useQuery({
    queryKey: ["repository", owner, repo],
    queryFn: () => api.github.getRepository({ owner, repo }),
    enabled: isRepositoryRoute && hasRepositoryParts,
    staleTime: 120_000
  });

  const contents = useQuery({
    queryKey: ["contents", owner, repo, repository.data?.defaultBranch],
    queryFn: () => api.github.listContents({ owner, repo, ref: repository.data?.defaultBranch ?? undefined }),
    enabled: isRepositoryRoute && activeRepositoryTab === "code" && hasRepositoryParts && repository.isSuccess,
    staleTime: 120_000
  });

  const issues = useQuery({
    queryKey: ["issues", owner, repo],
    queryFn: () => api.github.listIssues({ owner, repo, state: "open" }),
    enabled: isRepositoryRoute && activeRepositoryTab === "issues" && hasRepositoryParts,
    staleTime: 60_000
  });

  const pulls = useQuery({
    queryKey: ["pulls", owner, repo],
    queryFn: () => api.github.listPullRequests({ owner, repo, state: "open" }),
    enabled: isRepositoryRoute && activeRepositoryTab === "pulls" && hasRepositoryParts,
    staleTime: 60_000
  });

  const discussions = useQuery({
    queryKey: ["discussions", owner, repo],
    queryFn: () => api.github.listDiscussions({ owner, repo, limit: 30 }),
    enabled: false
  });

  const actions = useQuery({
    queryKey: ["actions", owner, repo],
    queryFn: () => api.github.listActions({ owner, repo, limit: 20 }),
    enabled: isRepositoryRoute && activeRepositoryTab === "actions" && hasRepositoryParts,
    staleTime: 60_000
  });

  const projects = useQuery({
    queryKey: ["projects", owner, repo],
    queryFn: () => api.github.listProjects({ owner, repo, limit: 20 }),
    enabled: false
  });

  const releases = useQuery({
    queryKey: ["releases", owner, repo],
    queryFn: () => api.github.listReleases({ owner, repo, limit: 20 }),
    enabled: isRepositoryRoute && hasRepositoryParts && repository.isSuccess,
    staleTime: 120_000
  });

  const contributors = useQuery({
    queryKey: ["contributors", owner, repo],
    queryFn: () => api.github.listContributors({ owner, repo }),
    enabled: isRepositoryRoute && hasRepositoryParts && repository.isSuccess,
    staleTime: 120_000
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
        profile={accountProfile.data}
        repositories={repositories.data ?? []}
        selectedRepository={effectiveRepository}
        route={route}
        onSelectRepository={goToRepository}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <TopBar
        viewer={appState.data?.viewer ?? null}
        selectedRepository={selectedRepository}
        onGoRepository={() => goToRepository(effectiveRepository)}
        onOpenExternal={(url) => void api.openExternal(url)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <section className={isRepositoryRoute ? "workspace" : "workspace workspace-wide"}>
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
              contentsLoading={contents.isLoading || contents.isFetching}
              issues={issues.data ?? []}
              issuesLoading={issues.isLoading || issues.isFetching}
              pulls={pulls.data ?? []}
              pullsLoading={pulls.isLoading || pulls.isFetching}
              discussions={discussions.data ?? []}
              actions={actions.data ?? []}
              actionsLoading={actions.isLoading || actions.isFetching}
              projects={projects.data ?? []}
              loading={repository.isLoading}
              error={
                repository.error ??
                (activeRepositoryTab === "code" ? contents.error : null) ??
                (activeRepositoryTab === "issues" ? issues.error : null) ??
                (activeRepositoryTab === "pulls" ? pulls.error : null) ??
                (activeRepositoryTab === "actions" ? actions.error : null)
              }
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
              routeKind={route.kind}
              issues={accountIssues.data ?? []}
              pulls={accountPulls.data ?? []}
              repositories={repositories.data ?? []}
              viewerLogin={appState.data?.viewer?.login ?? accountProfile.data?.login ?? null}
              onOpenExternal={(url) => void api.openExternal(url)}
              onOpenRepository={goToRepository}
            />
          )}
        </main>
      </section>

      {isRepositoryRoute && (
        <RightRail
          repository={repository.data}
          releases={releases.data ?? []}
          contributors={contributors.data ?? []}
          onOpenExternal={(url) => void api.openExternal(url)}
        />
      )}

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
  if (label === "Repositories") {
    return route.kind === "repositories";
  }
  if (label === "Organizations") {
    return route.kind === "organizations";
  }
  if (label === "Mailbox") {
    return route.kind === "mailbox";
  }
  return false;
}

function Sidebar({
  appState,
  profile,
  repositories,
  selectedRepository,
  route,
  onSelectRepository,
  onOpenSettings
}: {
  appState?: AppState;
  profile?: GitHubAccountProfile;
  repositories: RepositorySummary[];
  selectedRepository: string;
  route: AppRoute;
  onSelectRepository(nameWithOwner: string): void;
  onOpenSettings(): void;
}): JSX.Element {
  const goHome = useUiStore((state) => state.goHome);
  const goToRepositories = useUiStore((state) => state.goToRepositories);
  const goToOrganizations = useUiStore((state) => state.goToOrganizations);
  const goToMailbox = useUiStore((state) => state.goToMailbox);
  const parentRef = useRef<HTMLDivElement | null>(null);
  const viewerLogin = appState?.viewer?.login ?? profile?.login ?? null;
  const pinnedRepositories = profile?.pinnedRepositories?.length
    ? profile.pinnedRepositories
    : repositories.slice(0, 6);
  const virtualizer = useVirtualizer({
    count: pinnedRepositories.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 45,
    overscan: 8
  });

  return (
    <aside className="sidebar">
      <nav className="nav-list">
        {navigation.map((item) => {
          const Icon = item.icon;
          return (
            <button
              className={`nav-item ${isNavigationActive(route, item.label) ? "active" : ""}`}
              key={item.label}
              type="button"
              onClick={() => {
                if (item.key === "home") {
                  goHome();
                  return;
                }
                if (item.key === "repositories") {
                  goToRepositories();
                  return;
                }
                if (item.key === "organizations") {
                  goToOrganizations();
                  return;
                }
                goToMailbox();
              }}
              title={item.label}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <section className="repo-section">
        <div className="section-title-row">
          <span>Pinned repositories</span>
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
              const repository = pinnedRepositories[virtualRow.index];
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
                  <span>{displayRepositoryName(repository, viewerLogin)}</span>
                  {repository.isPrivate && <Lock size={13} />}
                </button>
              );
            })}
          </div>
        </div>

        <button className="show-more" type="button" onClick={goToRepositories}>
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
  onGoRepository,
  onOpenExternal,
  onOpenSettings
}: {
  viewer: AppState["viewer"];
  selectedRepository: string | null;
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
          title="Notifications"
          aria-label="Notifications"
          onClick={() => onOpenExternal("https://github.com/notifications")}
        >
          <Bell size={18} />
        </button>
        {selectedRepository && (
          <button
            className="titlebar-action-button"
            type="button"
            title={`Open ${selectedRepository}`}
            onClick={onGoRepository}
          >
            <Code2 size={16} />
            <span>{selectedRepository.split("/")[1] ?? "Repo"}</span>
          </button>
        )}
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
  const latestRepositories = sortRepositoriesByActivity(repositories).slice(0, 6);
  const workItems = [
    ...issues.slice(0, 5).map((issue) => ({ ...issue, kind: "issue" as const })),
    ...pulls.slice(0, 5).map((pull) => ({ ...pull, kind: "pull" as const }))
  ]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 8);

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
        <Metric label="Open issues" value={issues.length} />
        <Metric label="Open PRs" value={pulls.length} />
      </section>

      <section className="home-grid">
        <article className="home-panel">
          <header>
            <h2>Latest repository activity</h2>
          </header>
          <div className="home-repo-grid">
            {latestRepositories.map((repository) => (
              <button
                key={repository.id}
                type="button"
                onClick={() => onOpenRepository(repository.nameWithOwner)}
              >
                <strong>{displayRepositoryName(repository, login)}</strong>
                <small>{repository.description ?? "Repository"}</small>
                <span>
                  {repository.primaryLanguage?.name ?? "Code"} · updated{" "}
                  {formatRelativeDate(repositoryActivityDate(repository))}
                </span>
              </button>
            ))}
          </div>
        </article>

        <article className="home-panel">
          <header>
            <h2>Your work</h2>
          </header>
          <div className="table-panel compact-table">
            {workItems.map((item) => (
              <button
                key={`${item.repositoryNameWithOwner ?? "item"}-${item.number}`}
                className="issue-row"
                type="button"
                onClick={() => onOpenExternal(item.htmlUrl)}
              >
                {item.kind === "pull" ? <GitPullRequest size={17} /> : <CircleDot size={17} />}
                <div>
                  <strong>{item.title}</strong>
                  <small>
                    {item.repositoryNameWithOwner ?? "GitHub"} #{item.number} · updated{" "}
                    {formatRelativeDate(item.updatedAt)}
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
  contentsLoading,
  issues,
  issuesLoading,
  pulls,
  pullsLoading,
  discussions,
  actions,
  actionsLoading,
  projects,
  loading,
  error,
  onOpenExternal,
  onMutate
}: {
  repository?: RepositoryDetail;
  contents: RepoEntry[];
  contentsLoading: boolean;
  issues: IssueSummary[];
  issuesLoading: boolean;
  pulls: PullRequestSummary[];
  pullsLoading: boolean;
  discussions: DiscussionSummary[];
  actions: WorkflowRunSummary[];
  actionsLoading: boolean;
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
    pulls: counts.pulls
  };

  return (
    <article className="repo-page">
      <section className="repo-hero">
        <div className="repo-icon">
          <span>{repo.owner.slice(0, 1).toUpperCase()}</span>
          {repo.avatarUrl && <img src={repo.avatarUrl} alt="" onError={(event) => event.currentTarget.remove()} />}
        </div>
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
          <button
            type="button"
            onClick={() => onOpenExternal(repositoryPath(repo, "/settings"))}
            title="Repository settings"
          >
            <Settings size={16} /> Settings
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

      {tab === "code" && (
        <CodeTab
          repository={repo}
          contents={contents}
          contentsLoading={contentsLoading}
          onOpenExternal={onOpenExternal}
        />
      )}
      {tab === "issues" && (
        <IssuesTab
          repository={repo}
          issues={issues}
          loading={issuesLoading}
          onMutate={onMutate}
          onOpenExternal={onOpenExternal}
        />
      )}
      {tab === "pulls" && (
        <PullRequestsTab
          repository={repo}
          pulls={pulls}
          loading={pullsLoading}
          onMutate={onMutate}
          onOpenExternal={onOpenExternal}
        />
      )}
      {tab === "actions" && (
        <ActionsTab
          repository={repo}
          actions={actions}
          loading={actionsLoading}
          onMutate={onMutate}
          onOpenExternal={onOpenExternal}
        />
      )}
      {tab === "agents" && <AgentsTab repository={repo} onOpenExternal={onOpenExternal} />}
      {tab === "wiki" && <WikiTab repository={repo} onOpenExternal={onOpenExternal} />}
      {tab === "securityQuality" && <SecurityQualityTab repository={repo} onOpenExternal={onOpenExternal} />}
    </article>
  );
}

function CodeTab({
  repository,
  contents,
  contentsLoading,
  onOpenExternal
}: {
  repository: RepositoryDetail;
  contents: RepoEntry[];
  contentsLoading: boolean;
  onOpenExternal(url: string): void;
}): JSX.Element {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const repositoryUpdatedAt = repositoryActivityDate(repository);
  const virtualizer = useVirtualizer({
    count: contents.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 8
  });
  const virtualRows = virtualizer.getVirtualItems();
  const visibleFileRows =
    virtualRows.length > 0 ? virtualRows : contents.map((_, index) => ({ index, start: index * 36 }));

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
          <span className="mini-avatar">{repository.owner.slice(0, 1).toUpperCase()}</span>
          <strong>{repository.owner}</strong>
          <span>{repository.description ?? `${repository.name} repository`}</span>
          <CheckCircle2 size={16} />
          <small>{repository.defaultBranch ?? "HEAD"}</small>
          <small>{formatRelativeDate(repositoryUpdatedAt)}</small>
          <small>updated</small>
        </div>
        <div className="virtual-file-list" ref={parentRef}>
          {contentsLoading && contents.length === 0 ? (
            <div className="empty-state">Loading files...</div>
          ) : (
            <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
              {visibleFileRows.map((virtualRow) => {
                const item = contents[virtualRow.index];
                return (
                  <button
                    className="file-row"
                    key={item.sha}
                    type="button"
                    style={{ transform: `translateY(${virtualRow.start}px)` }}
                    onClick={() => onOpenExternal(repositoryEntryPath(repository, item))}
                    title={`Open ${item.path} on GitHub`}
                  >
                    <EntryIcon entry={item} />
                    <strong>{item.name}</strong>
                    <span>{item.lastCommitMessage ?? (item.type === "dir" ? "Open folder" : "Open file")}</span>
                    <time>{formatRelativeDate(item.lastCommitDate ?? repositoryUpdatedAt)}</time>
                  </button>
                );
              })}
            </div>
          )}
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
        </div>
      </section>
    </section>
  );
}

function IssuesTab({
  repository,
  issues,
  loading,
  onOpenExternal,
  onMutate
}: {
  repository: RepositoryDetail;
  issues: IssueSummary[];
  loading: boolean;
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
      {loading && issues.length === 0 && <div className="empty-state">Loading issues...</div>}
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
  loading,
  onOpenExternal,
  onMutate
}: {
  repository: RepositoryDetail;
  pulls: PullRequestSummary[];
  loading: boolean;
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
      {loading && pulls.length === 0 && <div className="empty-state">Loading pull requests...</div>}
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
  loading,
  onOpenExternal,
  onMutate
}: {
  repository: RepositoryDetail;
  actions: WorkflowRunSummary[];
  loading: boolean;
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
      {loading && actions.length === 0 && <div className="empty-state">Loading workflow runs...</div>}
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

function AgentsTab({
  repository,
  onOpenExternal
}: {
  repository: RepositoryDetail;
  onOpenExternal(url: string): void;
}): JSX.Element {
  const agentLinks = [
    {
      title: "Agent issues",
      description: "Open repository work labeled for agents.",
      icon: Bot,
      path: "/issues?q=is%3Aissue%20is%3Aopen%20label%3Aagent"
    },
    {
      title: "Automation runs",
      description: "Review workflow runs agents can act on.",
      icon: Workflow,
      path: "/actions"
    },
    {
      title: "Pull request queue",
      description: "Open pull requests that may need review or fixes.",
      icon: GitPullRequest,
      path: "/pulls"
    }
  ];

  return (
    <section className="tile-grid">
      {agentLinks.map((item) => {
        const Icon = item.icon;
        return (
          <button
            className="project-tile"
            key={item.title}
            type="button"
            onClick={() => onOpenExternal(repositoryPath(repository, item.path))}
          >
            <Icon size={20} />
            <strong>{item.title}</strong>
            <small>{item.description}</small>
          </button>
        );
      })}
    </section>
  );
}

function WikiTab({
  repository,
  onOpenExternal
}: {
  repository: RepositoryDetail;
  onOpenExternal(url: string): void;
}): JSX.Element {
  return (
    <section className="tile-grid">
      <button
        className="project-tile"
        type="button"
        onClick={() => onOpenExternal(repositoryPath(repository, "/wiki"))}
      >
        <BookOpen size={20} />
        <strong>Repository wiki</strong>
        <small>Open the GitHub wiki for {repository.nameWithOwner}.</small>
      </button>
      <button
        className="project-tile"
        type="button"
        onClick={() => onOpenExternal(repositoryPath(repository, "/wiki/_new"))}
      >
        <Plus size={20} />
        <strong>New wiki page</strong>
        <small>Create or edit long-form repository documentation on GitHub.</small>
      </button>
    </section>
  );
}

function SecurityQualityTab({
  repository,
  onOpenExternal
}: {
  repository: RepositoryDetail;
  onOpenExternal(url: string): void;
}): JSX.Element {
  const qualityLinks = [
    { title: "Security policy", path: "/security/policy", icon: ShieldCheck },
    { title: "Code scanning", path: "/security/code-scanning", icon: Gauge },
    { title: "Dependabot", path: "/security/dependabot", icon: CheckCircle2 },
    { title: "Secret scanning", path: "/security/secret-scanning", icon: ShieldCheck },
    { title: "Community standards", path: "/community", icon: BookOpen },
    { title: "Pulse", path: "/pulse", icon: Workflow }
  ];

  return (
    <section className="tile-grid">
      {qualityLinks.map((item) => {
        const Icon = item.icon;
        return (
          <button
            className="project-tile"
            key={item.title}
            type="button"
            onClick={() => onOpenExternal(repositoryPath(repository, item.path))}
          >
            <Icon size={20} />
            <strong>{item.title}</strong>
            <small>{repository.nameWithOwner}</small>
          </button>
        );
      })}
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
  routeKind,
  issues,
  pulls,
  repositories,
  viewerLogin,
  onOpenExternal,
  onOpenRepository
}: {
  title: string;
  routeKind: "mailbox" | "repositories" | "organizations";
  issues: IssueSummary[];
  pulls: PullRequestSummary[];
  repositories: RepositorySummary[];
  viewerLogin: string | null;
  onOpenExternal(url: string): void;
  onOpenRepository(nameWithOwner: string): void;
}): JSX.Element {
  const workRows = [
    ...issues.map((issue) => ({ ...issue, kind: "issue" as const })),
    ...pulls.map((pull) => ({ ...pull, kind: "pull" as const }))
  ].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const organizations = Object.values(
    repositories.reduce<Record<string, { owner: string; count: number; latest: string | null }>>(
      (acc, repository) => {
        if (viewerLogin && repository.owner.toLowerCase() === viewerLogin.toLowerCase()) {
          return acc;
        }

        const current = acc[repository.owner] ?? { owner: repository.owner, count: 0, latest: null };
        const latest = repositoryActivityDate(repository);
        acc[repository.owner] = {
          owner: repository.owner,
          count: current.count + 1,
          latest:
            latest && (!current.latest || new Date(latest).getTime() > new Date(current.latest).getTime())
              ? latest
              : current.latest
        };
        return acc;
      },
      {}
    )
  ).sort((a, b) => new Date(b.latest ?? 0).getTime() - new Date(a.latest ?? 0).getTime());

  const actionLabel =
    routeKind === "repositories" ? "New repository" : routeKind === "organizations" ? "New org" : "Notifications";
  const actionUrl =
    routeKind === "repositories"
      ? "https://github.com/new"
      : routeKind === "organizations"
        ? "https://github.com/account/organizations/new"
        : "https://github.com/notifications";

  return (
    <section className="collection-view">
      <header>
        <h2>{title}</h2>
        <button type="button" onClick={() => onOpenExternal(actionUrl)}>
          <Plus size={16} /> {actionLabel}
        </button>
      </header>
      <div className="table-panel">
        {routeKind === "mailbox" &&
          workRows.map((row) => (
            <button
              className="issue-row"
              key={`${row.kind}-${row.id}`}
              type="button"
              onClick={() => onOpenExternal(row.htmlUrl)}
            >
              {row.kind === "pull" ? <GitPullRequest size={17} /> : <CircleDot size={17} />}
              <div>
                <strong>{row.title}</strong>
                <small>
                  {row.repositoryNameWithOwner ?? "GitHub"} #{row.number} · updated{" "}
                  {formatRelativeDate(row.updatedAt)}
                </small>
              </div>
            </button>
          ))}
        {routeKind === "repositories" &&
          sortRepositoriesByActivity(repositories).map((repository) => (
            <button
              className="issue-row repository-row"
              key={repository.id}
              type="button"
              onClick={() => onOpenRepository(repository.nameWithOwner)}
            >
              <span className="repo-avatar">{repository.owner.slice(0, 1).toUpperCase()}</span>
              <div>
                <strong>{displayRepositoryName(repository, viewerLogin)}</strong>
                <small>
                  {repository.description ?? "Repository"} · updated{" "}
                  {formatRelativeDate(repositoryActivityDate(repository))}
                </small>
              </div>
              <span className="state-chip">{repository.visibility.toLowerCase()}</span>
            </button>
          ))}
        {routeKind === "organizations" &&
          organizations.map((organization) => (
            <button
              className="issue-row repository-row"
              key={organization.owner}
              type="button"
              onClick={() => onOpenExternal(`https://github.com/${organization.owner}`)}
            >
              <Building2 size={17} />
              <div>
                <strong>{organization.owner}</strong>
                <small>
                  {formatCompactNumber(organization.count)} repositories · updated{" "}
                  {formatRelativeDate(organization.latest)}
                </small>
              </div>
            </button>
          ))}
        {routeKind === "mailbox" && workRows.length === 0 && (
          <div className="empty-state">No open issues or pull requests assigned to you.</div>
        )}
        {routeKind === "repositories" && repositories.length === 0 && (
          <div className="empty-state">No repositories loaded from GitHub.</div>
        )}
        {routeKind === "organizations" && organizations.length === 0 && (
          <div className="empty-state">No organization repositories loaded.</div>
        )}
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
