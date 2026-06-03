import { CircleDot, Code2, ExternalLink, GitPullRequest } from "lucide-react";
import type { JSX } from "react";

import type {
  AppState,
  GitHubAccountProfile,
  GitHubReadAvailability,
  IssueSummary,
  PullRequestSummary,
  RepositorySummary
} from "@shared/github";

import {
  displayRepositoryName,
  displayRepositoryShortcutName,
  maxRepositoryListLimit,
  repositoryShortcutChips,
  repositoryShortcutMetadataParts,
  repositoryShortcutsFromPins,
  sortRepositoriesByActivity,
  type RepositoryShortcut
} from "../repository/repositorySearch";
import { readAvailabilityMessage } from "../repository/repositoryUi";
import { formatCompactNumber, formatRelativeDate } from "../../utils/format";

const homeContributionWeekCount = 53;
const homeContributionColors = ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"] as const;
const homeContributionDateFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric"
});
const homeContributionMonthFormatter = new Intl.DateTimeFormat("en", {
  month: "short"
});
const homeActivityMonthFormatter = new Intl.DateTimeFormat("en", {
  month: "long",
  year: "numeric"
});

interface HomeContributionCell {
  key: string;
  date: string;
  weekday: number;
  label: string;
  count: number;
  level: number;
  color: string | null;
}

interface HomeContributionMonthLabel {
  key: string;
  label: string;
  column: number;
}

interface HomeContributionCalendarView {
  cells: HomeContributionCell[];
  monthLabels: HomeContributionMonthLabel[];
  activeDays: number;
  totalContributions: number;
  exact: boolean;
}

interface HomeActivityRepositoryStat {
  nameWithOwner: string;
  displayName: string;
  count: number;
  latestAt: string | null;
}

type HomeTimelineItem =
  | {
      kind: "repository";
      id: string;
      title: string;
      subtitle: string;
      date: string | null;
      repository: RepositorySummary;
    }
  | {
      kind: "pull";
      id: string;
      title: string;
      subtitle: string;
      date: string;
      pull: PullRequestSummary;
    }
  | {
      kind: "issue";
      id: string;
      title: string;
      subtitle: string;
      date: string;
      issue: IssueSummary;
    };

interface HomeDashboardProps {
  appState?: AppState;
  profile?: GitHubAccountProfile;
  profileAvailabilityMessage: string | null;
  repositories: RepositorySummary[];
  repositoryActivityLimit: number;
  repositoriesLoading: boolean;
  repositoriesError: Error | null;
  repositoriesAvailabilityMessage: string | null;
  pinnedRepositoryNames: string[];
  issues: IssueSummary[];
  issuesLoading: boolean;
  issuesError: Error | null;
  issuesAvailability: GitHubReadAvailability | null;
  pulls: PullRequestSummary[];
  pullsLoading: boolean;
  pullsError: Error | null;
  pullsAvailability: GitHubReadAvailability | null;
  onOpenRepository(nameWithOwner: string): void;
  onLoadMoreRepositories(): void;
  onOpenIssue(issue: IssueSummary): void;
  onOpenPullRequest(pullRequest: PullRequestSummary): void;
  onOpenExternal(url: string): void;
}

interface HomeMetricModel {
  label: string;
  value: number;
}

interface HomeDashboardModel {
  login: string;
  viewerLoading: boolean;
  displayName: string;
  avatarUrl: string | null;
  profileUrl: string;
  metrics: HomeMetricModel[];
  pinnedRepositories: RepositoryShortcut[];
  activity: HomeActivityModel;
}

interface HomeActivityModel {
  latestRepositories: RepositorySummary[];
  canLoadMoreRepositories: boolean;
  repositoriesAtLoadedLimit: boolean;
  contributionCalendar: HomeContributionCalendarView;
  contributionGridColumns: string;
  contributionHeading: string;
  activeContributionDays: number;
  topActivityRepositories: HomeActivityRepositoryStat[];
  maxActivityRepositoryCount: number;
  activityTimelineItems: HomeTimelineItem[];
  activityLoading: boolean;
  activityErrors: string[];
  activityAvailabilityMessages: string[];
  timelineMonthLabel: string;
}

function homeActivityTime(value: string | null | undefined): number {
  if (!value) {
    return 0;
  }

  const time = Date.parse(value);
  return Number.isNaN(time) ? 0 : time;
}

function homeActivityDayKey(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function homeDateFromDayKey(dayKey: string): Date {
  const [year, month, day] = dayKey.split("-").map(Number);

  return new Date(year, month - 1, day);
}

function homeDayKeyAfter(dayKey: string, days: number): string {
  const date = homeDateFromDayKey(dayKey);
  date.setDate(date.getDate() + days);

  return homeActivityDayKey(date);
}

function homeContributionLevel(count: number): number {
  if (count >= 4) {
    return 4;
  }

  return count;
}

function homeContributionLabel(count: number, date: string, label: "contribution" | "update"): string {
  const formattedDate = homeContributionDateFormatter.format(homeDateFromDayKey(date));

  if (count === 0) {
    return label === "contribution"
      ? `No contributions on ${formattedDate}`
      : `No updates on ${formattedDate}`;
  }

  const countLabel = count === 1 ? `1 ${label}` : `${count} ${label}s`;

  return `${countLabel} on ${formattedDate}`;
}

function buildHomeContributionCells(
  calendar: GitHubAccountProfile["contributionCalendar"]
): HomeContributionCell[] {
  if (!calendar?.weeks.length) {
    return [];
  }

  return calendar.weeks.flatMap((week) => {
    const daysByWeekday = new Map(week.contributionDays.map((day) => [day.weekday, day]));

    return Array.from({ length: 7 }, (_, weekday) => {
      const day = daysByWeekday.get(weekday);
      const date = day?.date ?? homeDayKeyAfter(week.firstDay, weekday);
      const count = day?.contributionCount ?? 0;
      const level = homeContributionLevel(count);

      return {
        key: date,
        date,
        weekday,
        count,
        level,
        color: day?.color ?? homeContributionColors[level],
        label: homeContributionLabel(count, date, "contribution")
      };
    });
  });
}

function buildHomeContributionFallbackCells(
  values: Array<string | null | undefined>
): HomeContributionCell[] {
  const counts = new Map<string, number>();
  const times: number[] = [];

  for (const value of values) {
    const time = homeActivityTime(value);
    if (time > 0) {
      times.push(time);
    }
  }

  for (const time of times) {
    const key = homeActivityDayKey(new Date(time));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const endDate = new Date(times.length ? Math.max(...times) : Date.now());
  endDate.setHours(0, 0, 0, 0);
  endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));

  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - homeContributionWeekCount * 7 + 1);

  return Array.from({ length: homeContributionWeekCount * 7 }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    const key = homeActivityDayKey(date);
    const count = counts.get(key) ?? 0;
    const level = homeContributionLevel(count);

    return {
      key,
      date: key,
      weekday: date.getDay(),
      count,
      level,
      color: homeContributionColors[level],
      label: homeContributionLabel(count, key, "update")
    };
  });
}

function buildHomeContributionMonthLabels(cells: HomeContributionCell[]): HomeContributionMonthLabel[] {
  const labels: HomeContributionMonthLabel[] = [];
  const weekCount = Math.ceil(cells.length / 7);
  let lastMonthKey: string | null = null;

  for (let weekIndex = 0; weekIndex < weekCount; weekIndex += 1) {
    let monthStartCell: HomeContributionCell | null = null;

    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const cell = cells[weekIndex * 7 + dayIndex];
      if (cell && homeDateFromDayKey(cell.date).getDate() <= 7) {
        monthStartCell = cell;
        break;
      }
    }

    if (!monthStartCell) {
      continue;
    }

    const date = homeDateFromDayKey(monthStartCell.date);
    const monthKey = `${date.getFullYear()}-${date.getMonth()}`;

    if (monthKey === lastMonthKey) {
      continue;
    }

    labels.push({
      key: monthKey,
      label: homeContributionMonthFormatter.format(date),
      column: weekIndex + 1
    });
    lastMonthKey = monthKey;
  }

  return labels;
}

function buildHomeContributionCalendarView(
  calendar: GitHubAccountProfile["contributionCalendar"],
  fallbackValues: Array<string | null | undefined>
): HomeContributionCalendarView {
  const exactCells = buildHomeContributionCells(calendar);

  if (exactCells.length > 0 && calendar) {
    return {
      cells: exactCells,
      monthLabels: buildHomeContributionMonthLabels(exactCells),
      activeDays: exactCells.filter((cell) => cell.count > 0).length,
      totalContributions: calendar.totalContributions,
      exact: true
    };
  }

  const fallbackCells = buildHomeContributionFallbackCells(fallbackValues);
  const totalContributions = fallbackCells.reduce((total, cell) => total + cell.count, 0);

  return {
    cells: fallbackCells,
    monthLabels: buildHomeContributionMonthLabels(fallbackCells),
    activeDays: fallbackCells.filter((cell) => cell.count > 0).length,
    totalContributions,
    exact: false
  };
}

function homeTimelineMonthLabel(items: HomeTimelineItem[]): string {
  const firstDate = items.find((item) => homeActivityTime(item.date) > 0)?.date;
  const time = homeActivityTime(firstDate);
  return time ? homeActivityMonthFormatter.format(new Date(time)) : "Recent activity";
}

function homeRepositoryShortcutMetadataParts(repository: RepositoryShortcut): string[] {
  const languageName = repository.primaryLanguage?.name;

  return repositoryShortcutMetadataParts(repository).filter((part) => part !== languageName);
}

function buildHomeActivityTimelineItems({
  latestRepositories,
  pulls,
  issues,
  login
}: {
  latestRepositories: RepositorySummary[];
  pulls: PullRequestSummary[];
  issues: IssueSummary[];
  login: string;
}): HomeTimelineItem[] {
  const timelineItems: HomeTimelineItem[] = [];

  for (const repository of latestRepositories) {
    timelineItems.push({
      kind: "repository",
      id: `repository-${repository.id}`,
      title: displayRepositoryName(repository, login),
      subtitle:
        repository.owner.toLowerCase() === login.toLowerCase()
          ? (repository.description ?? "Repository")
          : repository.nameWithOwner,
      date: repository.pushedAt ?? repository.updatedAt,
      repository
    });
  }

  for (const pull of pulls) {
    timelineItems.push({
      kind: "pull",
      id: `pull-${pull.repositoryNameWithOwner ?? "github"}-${pull.number}`,
      title: pull.title,
      subtitle: `${pull.repositoryNameWithOwner ?? "GitHub"} #${pull.number}`,
      date: pull.updatedAt,
      pull
    });
  }

  for (const issue of issues) {
    timelineItems.push({
      kind: "issue",
      id: `issue-${issue.repositoryNameWithOwner ?? "github"}-${issue.number}`,
      title: issue.title,
      subtitle: `${issue.repositoryNameWithOwner ?? "GitHub"} #${issue.number}`,
      date: issue.updatedAt,
      issue
    });
  }

  timelineItems.sort((a, b) => homeActivityTime(b.date) - homeActivityTime(a.date));

  return timelineItems.slice(0, 12);
}

function buildHomeActivityDates({
  latestRepositories,
  pulls,
  issues
}: {
  latestRepositories: RepositorySummary[];
  pulls: PullRequestSummary[];
  issues: IssueSummary[];
}): Array<string | null | undefined> {
  const dates: Array<string | null | undefined> = [];

  for (const repository of latestRepositories) {
    dates.push(repository.pushedAt ?? repository.updatedAt);
  }
  for (const pull of pulls) {
    dates.push(pull.updatedAt);
  }
  for (const issue of issues) {
    dates.push(issue.updatedAt);
  }

  return dates;
}

function buildHomeActivityRepositoryStats({
  latestRepositories,
  pulls,
  issues,
  repositories,
  login
}: {
  latestRepositories: RepositorySummary[];
  pulls: PullRequestSummary[];
  issues: IssueSummary[];
  repositories: RepositorySummary[];
  login: string;
}): HomeActivityRepositoryStat[] {
  const repositoryByName = new Map(repositories.map((repository) => [repository.nameWithOwner, repository]));
  const activityRepositoryStats = new Map<string, HomeActivityRepositoryStat>();
  const upsertActivityRepository = (
    nameWithOwner: string | null | undefined,
    count: number,
    date: string | null | undefined
  ): void => {
    if (!nameWithOwner) {
      return;
    }

    const repository = repositoryByName.get(nameWithOwner);
    const current = activityRepositoryStats.get(nameWithOwner);
    const latestAt =
      homeActivityTime(date) > homeActivityTime(current?.latestAt)
        ? (date ?? null)
        : (current?.latestAt ?? null);

    activityRepositoryStats.set(nameWithOwner, {
      nameWithOwner,
      displayName: repository ? displayRepositoryName(repository, login) : nameWithOwner,
      count: (current?.count ?? 0) + count,
      latestAt
    });
  };

  for (const repository of latestRepositories) {
    upsertActivityRepository(repository.nameWithOwner, 1, repository.pushedAt ?? repository.updatedAt);
  }
  for (const pull of pulls) {
    upsertActivityRepository(pull.repositoryNameWithOwner, 1, pull.updatedAt);
  }
  for (const issue of issues) {
    upsertActivityRepository(issue.repositoryNameWithOwner, 1, issue.updatedAt);
  }

  const topActivityRepositories = Array.from(activityRepositoryStats.values());
  topActivityRepositories.sort(
    (a, b) =>
      b.count - a.count ||
      homeActivityTime(b.latestAt) - homeActivityTime(a.latestAt) ||
      a.nameWithOwner.localeCompare(b.nameWithOwner)
  );

  return topActivityRepositories.slice(0, 4);
}

function buildHomeActivityModel({
  profile,
  repositories,
  repositoryActivityLimit,
  repositoriesLoading,
  repositoriesError,
  repositoriesAvailabilityMessage,
  issues,
  issuesLoading,
  issuesError,
  issuesAvailability,
  pulls,
  pullsLoading,
  pullsError,
  pullsAvailability,
  login
}: HomeDashboardProps & { login: string }): HomeActivityModel {
  const sortedRepositories = sortRepositoriesByActivity(repositories);
  const visibleRepositoryLimit = Math.min(
    repositoryActivityLimit,
    sortedRepositories.length,
    maxRepositoryListLimit
  );
  const latestRepositories = sortedRepositories.slice(0, visibleRepositoryLimit);
  const canLoadMoreRepositories =
    sortedRepositories.length > latestRepositories.length && repositoryActivityLimit < maxRepositoryListLimit;
  const repositoriesAtLoadedLimit =
    !canLoadMoreRepositories &&
    sortedRepositories.length > 0 &&
    latestRepositories.length >= Math.min(sortedRepositories.length, maxRepositoryListLimit);
  const activityTimelineItems = buildHomeActivityTimelineItems({ latestRepositories, pulls, issues, login });
  const activityDates = buildHomeActivityDates({ latestRepositories, pulls, issues });
  const contributionCalendar = buildHomeContributionCalendarView(
    profile?.contributionCalendar,
    activityDates
  );
  const contributionWeekCount = Math.max(1, Math.ceil(contributionCalendar.cells.length / 7));
  const totalActivityUpdates = contributionCalendar.totalContributions;
  const topActivityRepositories = buildHomeActivityRepositoryStats({
    latestRepositories,
    pulls,
    issues,
    repositories,
    login
  });
  const maxActivityRepositoryCount = Math.max(
    1,
    ...topActivityRepositories.map((repository) => repository.count)
  );

  return {
    latestRepositories,
    canLoadMoreRepositories,
    repositoriesAtLoadedLimit,
    contributionCalendar,
    contributionGridColumns: `repeat(${contributionWeekCount}, 10px)`,
    contributionHeading: contributionCalendar.exact
      ? `${formatCompactNumber(totalActivityUpdates)} contributions in the last year`
      : `${formatCompactNumber(totalActivityUpdates)} visible updates`,
    activeContributionDays: contributionCalendar.activeDays,
    topActivityRepositories,
    maxActivityRepositoryCount,
    activityTimelineItems,
    activityLoading: repositoriesLoading || issuesLoading || pullsLoading,
    activityErrors: [
      repositoriesError ? `Repositories unavailable: ${repositoriesError.message}` : null,
      issuesError ? `Issues unavailable: ${issuesError.message}` : null,
      pullsError ? `Pull requests unavailable: ${pullsError.message}` : null
    ].filter((message): message is string => Boolean(message)),
    activityAvailabilityMessages: [
      repositoriesAvailabilityMessage,
      readAvailabilityMessage("Account issues", issuesAvailability),
      readAvailabilityMessage("Account pull requests", pullsAvailability)
    ].filter((message): message is string => Boolean(message)),
    timelineMonthLabel: homeTimelineMonthLabel(activityTimelineItems)
  };
}

function buildHomeDashboardModel(props: HomeDashboardProps): HomeDashboardModel {
  const { appState, profile, repositories, pinnedRepositoryNames, issues, pulls } = props;
  const login = profile?.login ?? appState?.viewer?.login ?? "github";
  const viewerLoading = Boolean(appState?.github.authenticated && !appState.viewer && !profile);
  const displayName = viewerLoading
    ? "Loading GitHub profile"
    : (profile?.name ?? appState?.viewer?.name ?? login);
  const avatarUrl = profile?.avatarUrl ?? appState?.viewer?.avatarUrl ?? null;

  return {
    login,
    viewerLoading,
    displayName,
    avatarUrl,
    profileUrl: profile?.htmlUrl ?? appState?.viewer?.htmlUrl ?? "https://github.com",
    metrics: [
      { label: "Repositories", value: profile?.repositoryCount ?? repositories.length },
      { label: "Starred", value: profile?.starredRepositoryCount ?? 0 },
      { label: "Open issues", value: issues.length },
      { label: "Open PRs", value: pulls.length }
    ],
    pinnedRepositories: repositoryShortcutsFromPins(pinnedRepositoryNames, repositories),
    activity: buildHomeActivityModel({ ...props, login })
  };
}

export function HomeDashboard(props: HomeDashboardProps): JSX.Element {
  const model = buildHomeDashboardModel(props);

  return (
    <section className="home-dashboard">
      <HomeAccountHero
        login={model.login}
        model={model}
        profile={props.profile}
        profileAvailabilityMessage={props.profileAvailabilityMessage}
        onOpenExternal={props.onOpenExternal}
      />
      <section className="home-grid">
        <PinnedRepositoriesPanel
          login={model.login}
          repositories={model.pinnedRepositories}
          onOpenRepository={props.onOpenRepository}
        />
        <HomeActivityPanel
          activity={model.activity}
          onLoadMoreRepositories={props.onLoadMoreRepositories}
          onOpenIssue={props.onOpenIssue}
          onOpenPullRequest={props.onOpenPullRequest}
          onOpenRepository={props.onOpenRepository}
        />
      </section>
    </section>
  );
}

function HomeAccountHero({
  login,
  model,
  profile,
  profileAvailabilityMessage,
  onOpenExternal
}: {
  login: string;
  model: HomeDashboardModel;
  profile?: GitHubAccountProfile;
  profileAvailabilityMessage: string | null;
  onOpenExternal(url: string): void;
}): JSX.Element {
  function openGitHubProfile(): void {
    onOpenExternal(model.profileUrl);
  }

  return (
    <header className="account-hero account-hero-with-metrics">
      {model.avatarUrl ? (
        <img src={model.avatarUrl} alt="" />
      ) : (
        <span className={`avatar-placeholder ${model.viewerLoading ? "loading-avatar" : ""}`}>
          {login.slice(0, 1).toUpperCase()}
        </span>
      )}
      <div className="account-hero-copy">
        <div className="account-hero-title-row">
          <h1>{model.displayName}</h1>
          <button className="account-hero-profile-action" type="button" onClick={openGitHubProfile}>
            <ExternalLink size={16} /> Open profile
          </button>
        </div>
        <p>@{login}</p>
        {profile?.bio && <small>{profile.bio}</small>}
        {profileAvailabilityMessage && <small className="error-state">{profileAvailabilityMessage}</small>}
      </div>
      <div className="account-hero-metrics" aria-label="Account metrics">
        {model.metrics.map((metric) => (
          <HeroMetric key={metric.label} label={metric.label} value={metric.value} />
        ))}
      </div>
    </header>
  );
}

function PinnedRepositoriesPanel({
  repositories,
  login,
  onOpenRepository
}: {
  repositories: RepositoryShortcut[];
  login: string;
  onOpenRepository(nameWithOwner: string): void;
}): JSX.Element | null {
  if (repositories.length === 0) {
    return null;
  }

  return (
    <article className="home-panel">
      <header>
        <h2>Pinned repositories</h2>
      </header>
      <div className="home-repo-grid">
        {repositories.map((repository) => (
          <PinnedRepositoryCard
            key={repository.id}
            login={login}
            repository={repository}
            onOpenRepository={onOpenRepository}
          />
        ))}
      </div>
    </article>
  );
}

function PinnedRepositoryCard({
  repository,
  login,
  onOpenRepository
}: {
  repository: RepositoryShortcut;
  login: string;
  onOpenRepository(nameWithOwner: string): void;
}): JSX.Element {
  const metadataParts = homeRepositoryShortcutMetadataParts(repository);
  const chips = repositoryShortcutChips(repository);

  function openPinnedRepository(): void {
    onOpenRepository(repository.nameWithOwner);
  }

  return (
    <button type="button" onClick={openPinnedRepository}>
      <strong>{displayRepositoryShortcutName(repository, login)}</strong>
      <small>{repository.description ?? "Pinned locally in Control"}</small>
      {metadataParts.length > 0 && <span>{metadataParts.join(" · ")}</span>}
      <span className="home-repo-card-chips">
        {chips.map((chip) => (
          <span key={chip} className={`state-chip ${chip === "pinned" ? "success" : ""}`}>
            {chip}
          </span>
        ))}
      </span>
    </button>
  );
}

function HomeActivityPanel({
  activity,
  onLoadMoreRepositories,
  onOpenRepository,
  onOpenIssue,
  onOpenPullRequest
}: {
  activity: HomeActivityModel;
  onLoadMoreRepositories(): void;
  onOpenRepository(nameWithOwner: string): void;
  onOpenIssue(issue: IssueSummary): void;
  onOpenPullRequest(pullRequest: PullRequestSummary): void;
}): JSX.Element {
  return (
    <article className="home-panel home-activity-panel">
      <header>
        <h2>Latest repository activity</h2>
      </header>
      <div className="home-activity-overview">
        <HomeContributionGraph activity={activity} />
        <HomeActivityRepositorySummary activity={activity} />
      </div>
      <HomeActivityTimeline
        activity={activity}
        onLoadMoreRepositories={onLoadMoreRepositories}
        onOpenIssue={onOpenIssue}
        onOpenPullRequest={onOpenPullRequest}
        onOpenRepository={onOpenRepository}
      />
    </article>
  );
}

function HomeContributionGraph({ activity }: { activity: HomeActivityModel }): JSX.Element {
  const contributionGridStyle = { gridTemplateColumns: activity.contributionGridColumns };

  return (
    <section className="home-contribution-graph-panel" aria-label="Contribution overview">
      <div className="home-contribution-heading">
        <strong>{activity.contributionHeading}</strong>
        <span>{formatCompactNumber(activity.activeContributionDays)} active days</span>
      </div>
      <div className="home-contribution-calendar">
        <div aria-hidden="true" className="home-contribution-months" style={contributionGridStyle}>
          {activity.contributionCalendar.monthLabels.map((label) => (
            <HomeContributionMonthMarker key={label.key} label={label} />
          ))}
        </div>
        <div className="home-contribution-weekdays" aria-hidden="true">
          <span />
          <span>Mon</span>
          <span />
          <span>Wed</span>
          <span />
          <span>Fri</span>
          <span />
        </div>
        <div
          className="home-contribution-grid"
          style={contributionGridStyle}
          aria-label="Contribution activity in the last year"
        >
          {activity.contributionCalendar.cells.map((cell) => (
            <HomeContributionCellMarker key={`${cell.date}-${cell.weekday}`} cell={cell} />
          ))}
        </div>
      </div>
      <HomeContributionLegend />
    </section>
  );
}

function HomeContributionMonthMarker({ label }: { label: HomeContributionMonthLabel }): JSX.Element {
  const style = { gridColumn: `${label.column} / span 4` };

  return <span style={style}>{label.label}</span>;
}

function HomeContributionCellMarker({ cell }: { cell: HomeContributionCell }): JSX.Element {
  const style = { backgroundColor: cell.color ?? undefined };

  return (
    <span
      aria-label={cell.label}
      className={`home-contribution-cell level-${cell.level}`}
      style={style}
      title={cell.label}
    />
  );
}

function HomeContributionLegend(): JSX.Element {
  return (
    <div className="home-contribution-legend" aria-hidden="true">
      <span>Less</span>
      {homeContributionColors.map((color, level) => (
        <span
          key={color}
          className={`home-contribution-cell level-${level}`}
          style={{ backgroundColor: color }}
        />
      ))}
      <span>More</span>
    </div>
  );
}

function HomeActivityRepositorySummary({ activity }: { activity: HomeActivityModel }): JSX.Element {
  return (
    <section className="home-activity-repository-summary" aria-label="Activity overview">
      <h3>Activity overview</h3>
      {activity.topActivityRepositories.length > 0 ? (
        <div className="home-activity-repository-bars">
          {activity.topActivityRepositories.map((repository) => (
            <HomeActivityRepositoryBar
              key={repository.nameWithOwner}
              maxCount={activity.maxActivityRepositoryCount}
              repository={repository}
            />
          ))}
        </div>
      ) : (
        <p className="muted-row">No repository activity loaded.</p>
      )}
    </section>
  );
}

function HomeActivityRepositoryBar({
  repository,
  maxCount
}: {
  repository: HomeActivityRepositoryStat;
  maxCount: number;
}): JSX.Element {
  const barStyle = { width: `${Math.max(8, (repository.count / maxCount) * 100)}%` };

  return (
    <div className="home-activity-repository-bar">
      <div>
        <strong>{repository.displayName}</strong>
        <small>
          {repository.latestAt ? `updated ${formatRelativeDate(repository.latestAt)}` : "Repository activity"}
        </small>
      </div>
      <span className="home-activity-bar-track" aria-hidden="true">
        <span style={barStyle} />
      </span>
      <em>{formatCompactNumber(repository.count)}</em>
    </div>
  );
}

function HomeActivityTimeline({
  activity,
  onLoadMoreRepositories,
  onOpenRepository,
  onOpenIssue,
  onOpenPullRequest
}: {
  activity: HomeActivityModel;
  onLoadMoreRepositories(): void;
  onOpenRepository(nameWithOwner: string): void;
  onOpenIssue(issue: IssueSummary): void;
  onOpenPullRequest(pullRequest: PullRequestSummary): void;
}): JSX.Element {
  const showEmptyState =
    !activity.activityLoading &&
    activity.activityErrors.length === 0 &&
    activity.activityAvailabilityMessages.length === 0 &&
    activity.activityTimelineItems.length === 0;

  return (
    <section className="home-activity-timeline" aria-label="Contribution activity">
      <div className="home-activity-timeline-heading">
        <h3>Contribution activity</h3>
        <span>{activity.timelineMonthLabel}</span>
      </div>
      {activity.activityLoading && activity.activityTimelineItems.length === 0 && (
        <div className="loading-state">Loading repository activity…</div>
      )}
      {activity.activityErrors.map((message) => (
        <div className="error-state" key={message}>
          {message}
        </div>
      ))}
      {activity.activityAvailabilityMessages.map((message) => (
        <div className="error-state" key={message}>
          {message}
        </div>
      ))}
      {activity.activityTimelineItems.map((item) => (
        <HomeActivityTimelineRow
          item={item}
          key={item.id}
          onOpenIssue={onOpenIssue}
          onOpenPullRequest={onOpenPullRequest}
          onOpenRepository={onOpenRepository}
        />
      ))}
      {showEmptyState && <div className="empty-state">No activity loaded.</div>}
      {activity.canLoadMoreRepositories && (
        <div className="table-action-row">
          <button type="button" onClick={onLoadMoreRepositories}>
            Load more repository activity
          </button>
        </div>
      )}
      {activity.repositoriesAtLoadedLimit && (
        <div className="muted-row">
          Showing {activity.latestRepositories.length} loaded repositories for Home.
        </div>
      )}
    </section>
  );
}

function HomeActivityTimelineRow({
  item,
  onOpenRepository,
  onOpenIssue,
  onOpenPullRequest
}: {
  item: HomeTimelineItem;
  onOpenRepository(nameWithOwner: string): void;
  onOpenIssue(issue: IssueSummary): void;
  onOpenPullRequest(pullRequest: PullRequestSummary): void;
}): JSX.Element {
  const icon =
    item.kind === "repository" ? (
      <Code2 size={16} />
    ) : item.kind === "pull" ? (
      <GitPullRequest size={16} />
    ) : (
      <CircleDot size={16} />
    );
  const ariaLabel =
    item.kind === "repository"
      ? `Open ${item.repository.nameWithOwner}`
      : item.kind === "pull"
        ? `Open pull request #${item.pull.number}: ${item.pull.title}`
        : `Open issue #${item.issue.number}: ${item.issue.title}`;

  function openTimelineItem(): void {
    if (item.kind === "repository") {
      onOpenRepository(item.repository.nameWithOwner);
      return;
    }
    if (item.kind === "pull") {
      onOpenPullRequest(item.pull);
      return;
    }
    onOpenIssue(item.issue);
  }

  return (
    <button
      aria-label={ariaLabel}
      className={`home-activity-timeline-row ${item.kind}`}
      type="button"
      onClick={openTimelineItem}
    >
      <span className="home-activity-timeline-icon">{icon}</span>
      <span className="home-activity-timeline-copy">
        <strong>{item.title}</strong>
        <small>{item.subtitle}</small>
      </span>
      <time dateTime={item.date ?? undefined}>{formatRelativeDate(item.date)}</time>
    </button>
  );
}

function HeroMetric({ label, value }: { label: string; value: number }): JSX.Element {
  return (
    <div className="account-hero-metric">
      <strong>{formatCompactNumber(value)}</strong>
      <span>{label}</span>
    </div>
  );
}
