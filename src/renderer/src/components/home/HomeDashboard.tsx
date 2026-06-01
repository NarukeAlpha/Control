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
  const times = values.map((value) => homeActivityTime(value)).filter((time) => time > 0);

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
    const weekCells = cells.slice(weekIndex * 7, weekIndex * 7 + 7);
    const monthStartCell = weekCells.find((cell) => homeDateFromDayKey(cell.date).getDate() <= 7);

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

export function HomeDashboard({
  appState,
  profile,
  profileAvailabilityMessage,
  repositories,
  repositoryActivityLimit,
  repositoriesLoading,
  repositoriesError,
  repositoriesAvailabilityMessage,
  pinnedRepositoryNames,
  issues,
  issuesLoading,
  issuesError,
  issuesAvailability,
  pulls,
  pullsLoading,
  pullsError,
  pullsAvailability,
  onOpenRepository,
  onLoadMoreRepositories,
  onOpenIssue,
  onOpenPullRequest,
  onOpenExternal
}: {
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
}): JSX.Element {
  const login = profile?.login ?? appState?.viewer?.login ?? "github";
  const viewerLoading = Boolean(appState?.github.authenticated && !appState.viewer && !profile);
  const displayName = viewerLoading
    ? "Loading GitHub profile"
    : (profile?.name ?? appState?.viewer?.name ?? login);
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
  const pinnedRepositories = repositoryShortcutsFromPins(pinnedRepositoryNames, repositories);
  const repositoryByName = new Map(repositories.map((repository) => [repository.nameWithOwner, repository]));
  const activityTimelineItems: HomeTimelineItem[] = [
    ...latestRepositories.map((repository) => ({
      kind: "repository" as const,
      id: `repository-${repository.id}`,
      title: displayRepositoryName(repository, login),
      subtitle:
        repository.owner.toLowerCase() === login.toLowerCase()
          ? (repository.description ?? "Repository")
          : repository.nameWithOwner,
      date: repository.pushedAt ?? repository.updatedAt,
      repository
    })),
    ...pulls.map((pull) => ({
      kind: "pull" as const,
      id: `pull-${pull.repositoryNameWithOwner ?? "github"}-${pull.number}`,
      title: pull.title,
      subtitle: `${pull.repositoryNameWithOwner ?? "GitHub"} #${pull.number}`,
      date: pull.updatedAt,
      pull
    })),
    ...issues.map((issue) => ({
      kind: "issue" as const,
      id: `issue-${issue.repositoryNameWithOwner ?? "github"}-${issue.number}`,
      title: issue.title,
      subtitle: `${issue.repositoryNameWithOwner ?? "GitHub"} #${issue.number}`,
      date: issue.updatedAt,
      issue
    }))
  ]
    .sort((a, b) => homeActivityTime(b.date) - homeActivityTime(a.date))
    .slice(0, 12);
  const activityDates = [
    ...latestRepositories.map((repository) => repository.pushedAt ?? repository.updatedAt),
    ...pulls.map((pull) => pull.updatedAt),
    ...issues.map((issue) => issue.updatedAt)
  ];
  const contributionCalendar = buildHomeContributionCalendarView(
    profile?.contributionCalendar,
    activityDates
  );
  const contributionCells = contributionCalendar.cells;
  const activeContributionDays = contributionCalendar.activeDays;
  const contributionWeekCount = Math.max(1, Math.ceil(contributionCells.length / 7));
  const contributionGridStyle = {
    gridTemplateColumns: `repeat(${contributionWeekCount}, 10px)`
  };
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

  const topActivityRepositories = [...activityRepositoryStats.values()]
    .sort(
      (a, b) =>
        b.count - a.count ||
        homeActivityTime(b.latestAt) - homeActivityTime(a.latestAt) ||
        a.nameWithOwner.localeCompare(b.nameWithOwner)
    )
    .slice(0, 4);
  const maxActivityRepositoryCount = Math.max(
    1,
    ...topActivityRepositories.map((repository) => repository.count)
  );
  const totalActivityUpdates = contributionCalendar.totalContributions;
  const contributionHeading = contributionCalendar.exact
    ? `${formatCompactNumber(totalActivityUpdates)} contributions in the last year`
    : `${formatCompactNumber(totalActivityUpdates)} visible updates`;
  const activityLoading = repositoriesLoading || issuesLoading || pullsLoading;
  const activityErrors = [
    repositoriesError ? `Repositories unavailable: ${repositoriesError.message}` : null,
    issuesError ? `Issues unavailable: ${issuesError.message}` : null,
    pullsError ? `Pull requests unavailable: ${pullsError.message}` : null
  ].filter((message): message is string => Boolean(message));
  const activityAvailabilityMessages = [
    repositoriesAvailabilityMessage,
    readAvailabilityMessage("Account issues", issuesAvailability),
    readAvailabilityMessage("Account pull requests", pullsAvailability)
  ].filter((message): message is string => Boolean(message));
  const timelineMonthLabel = homeTimelineMonthLabel(activityTimelineItems);

  return (
    <section className="home-dashboard">
      <header className="account-hero account-hero-with-metrics">
        {(profile?.avatarUrl ?? appState?.viewer?.avatarUrl) ? (
          <img src={profile?.avatarUrl ?? appState?.viewer?.avatarUrl ?? ""} alt="" />
        ) : (
          <span className={`avatar-placeholder ${viewerLoading ? "loading-avatar" : ""}`}>
            {login.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="account-hero-copy">
          <div className="account-hero-title-row">
            <h1>{displayName}</h1>
            <button
              className="account-hero-profile-action"
              type="button"
              onClick={() =>
                onOpenExternal(profile?.htmlUrl ?? appState?.viewer?.htmlUrl ?? "https://github.com")
              }
            >
              <ExternalLink size={16} /> Open profile
            </button>
          </div>
          <p>@{login}</p>
          {profile?.bio && <small>{profile.bio}</small>}
          {profileAvailabilityMessage && <small className="error-state">{profileAvailabilityMessage}</small>}
        </div>
        <div className="account-hero-metrics" aria-label="Account metrics">
          <HeroMetric label="Repositories" value={profile?.repositoryCount ?? repositories.length} />
          <HeroMetric label="Starred" value={profile?.starredRepositoryCount ?? 0} />
          <HeroMetric label="Open issues" value={issues.length} />
          <HeroMetric label="Open PRs" value={pulls.length} />
        </div>
      </header>

      <section className="home-grid">
        {pinnedRepositories.length > 0 && (
          <article className="home-panel">
            <header>
              <h2>Pinned repositories</h2>
            </header>
            <div className="home-repo-grid">
              {pinnedRepositories.map((repository) => {
                const metadataParts = homeRepositoryShortcutMetadataParts(repository);
                const chips = repositoryShortcutChips(repository);

                return (
                  <button
                    key={repository.id}
                    type="button"
                    onClick={() => onOpenRepository(repository.nameWithOwner)}
                  >
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
              })}
            </div>
          </article>
        )}

        <article className="home-panel home-activity-panel">
          <header>
            <h2>Latest repository activity</h2>
          </header>

          <div className="home-activity-overview">
            <section className="home-contribution-graph-panel" aria-label="Contribution overview">
              <div className="home-contribution-heading">
                <strong>{contributionHeading}</strong>
                <span>{formatCompactNumber(activeContributionDays)} active days</span>
              </div>
              <div className="home-contribution-calendar">
                <div aria-hidden="true" className="home-contribution-months" style={contributionGridStyle}>
                  {contributionCalendar.monthLabels.map((label) => (
                    <span key={label.key} style={{ gridColumn: `${label.column} / span 4` }}>
                      {label.label}
                    </span>
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
                  {contributionCells.map((cell) => (
                    <span
                      aria-label={cell.label}
                      className={`home-contribution-cell level-${cell.level}`}
                      key={`${cell.date}-${cell.weekday}`}
                      style={{ backgroundColor: cell.color ?? undefined }}
                      title={cell.label}
                    />
                  ))}
                </div>
              </div>
              <div className="home-contribution-legend" aria-hidden="true">
                <span>Less</span>
                <span
                  className="home-contribution-cell level-0"
                  style={{ backgroundColor: homeContributionColors[0] }}
                />
                <span
                  className="home-contribution-cell level-1"
                  style={{ backgroundColor: homeContributionColors[1] }}
                />
                <span
                  className="home-contribution-cell level-2"
                  style={{ backgroundColor: homeContributionColors[2] }}
                />
                <span
                  className="home-contribution-cell level-3"
                  style={{ backgroundColor: homeContributionColors[3] }}
                />
                <span
                  className="home-contribution-cell level-4"
                  style={{ backgroundColor: homeContributionColors[4] }}
                />
                <span>More</span>
              </div>
            </section>

            <section className="home-activity-repository-summary" aria-label="Activity overview">
              <h3>Activity overview</h3>
              {topActivityRepositories.length > 0 ? (
                <div className="home-activity-repository-bars">
                  {topActivityRepositories.map((repository) => (
                    <div className="home-activity-repository-bar" key={repository.nameWithOwner}>
                      <div>
                        <strong>{repository.displayName}</strong>
                        <small>
                          {repository.latestAt
                            ? `updated ${formatRelativeDate(repository.latestAt)}`
                            : "Repository activity"}
                        </small>
                      </div>
                      <span className="home-activity-bar-track" aria-hidden="true">
                        <span
                          style={{
                            width: `${Math.max(8, (repository.count / maxActivityRepositoryCount) * 100)}%`
                          }}
                        />
                      </span>
                      <em>{formatCompactNumber(repository.count)}</em>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted-row">No repository activity loaded.</p>
              )}
            </section>
          </div>

          <section className="home-activity-timeline" aria-label="Contribution activity">
            <div className="home-activity-timeline-heading">
              <h3>Contribution activity</h3>
              <span>{timelineMonthLabel}</span>
            </div>
            {activityLoading && activityTimelineItems.length === 0 && (
              <div className="loading-state">Loading repository activity…</div>
            )}
            {activityErrors.map((message) => (
              <div className="error-state" key={message}>
                {message}
              </div>
            ))}
            {activityAvailabilityMessages.map((message) => (
              <div className="error-state" key={message}>
                {message}
              </div>
            ))}
            {activityTimelineItems.map((item) => {
              const icon =
                item.kind === "repository" ? (
                  <Code2 size={16} />
                ) : item.kind === "pull" ? (
                  <GitPullRequest size={16} />
                ) : (
                  <CircleDot size={16} />
                );
              const onOpen = (): void => {
                if (item.kind === "repository") {
                  onOpenRepository(item.repository.nameWithOwner);
                  return;
                }
                if (item.kind === "pull") {
                  onOpenPullRequest(item.pull);
                  return;
                }
                onOpenIssue(item.issue);
              };
              const ariaLabel =
                item.kind === "repository"
                  ? `Open ${item.repository.nameWithOwner}`
                  : item.kind === "pull"
                    ? `Open pull request #${item.pull.number}: ${item.pull.title}`
                    : `Open issue #${item.issue.number}: ${item.issue.title}`;

              return (
                <button
                  aria-label={ariaLabel}
                  className={`home-activity-timeline-row ${item.kind}`}
                  key={item.id}
                  type="button"
                  onClick={onOpen}
                >
                  <span className="home-activity-timeline-icon">{icon}</span>
                  <span className="home-activity-timeline-copy">
                    <strong>{item.title}</strong>
                    <small>{item.subtitle}</small>
                  </span>
                  <time dateTime={item.date ?? undefined}>{formatRelativeDate(item.date)}</time>
                </button>
              );
            })}
            {!activityLoading &&
              activityErrors.length === 0 &&
              activityAvailabilityMessages.length === 0 &&
              activityTimelineItems.length === 0 && <div className="empty-state">No activity loaded.</div>}
            {canLoadMoreRepositories && (
              <div className="table-action-row">
                <button type="button" onClick={onLoadMoreRepositories}>
                  Load more repository activity
                </button>
              </div>
            )}
            {repositoriesAtLoadedLimit && (
              <div className="muted-row">
                Showing {latestRepositories.length} loaded repositories for Home.
              </div>
            )}
          </section>
        </article>
      </section>
    </section>
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
