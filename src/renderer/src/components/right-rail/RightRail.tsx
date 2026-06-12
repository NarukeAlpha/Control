import { BookOpen, Eye, GitBranch, GitFork, Lock, Settings, ShieldCheck, Star, Tag } from "lucide-react";
import type { JSX } from "react";

import type {
  ContributorSummary,
  GitHubReadAvailability,
  ReleaseSummary,
  RepositoryDetail
} from "@shared/github";

import { formatCompactNumber, formatRelativeDate } from "../../utils/format";
import {
  getRepositoryCounts,
  languageTotalLabel,
  normalizeLanguageStats,
  readAvailabilityMessage
} from "../repository/repositoryUi";

export function RightRail({
  repository,
  releases,
  releasesLoading,
  releasesAvailability,
  releasesError,
  showReleases,
  contributors,
  contributorsLoading,
  contributorsAvailability,
  contributorsError,
  showContributors,
  showSettings,
  onOpenReleasesTab,
  onOpenContributorsTab,
  onOpenSettingsTab,
  onOpenRelease,
  onOpenContributor,
  onOpenExternal
}: {
  repository?: RepositoryDetail;
  releases: ReleaseSummary[];
  releasesLoading: boolean;
  releasesAvailability: GitHubReadAvailability | null;
  releasesError: Error | null;
  showReleases: boolean;
  contributors: ContributorSummary[];
  contributorsLoading: boolean;
  contributorsAvailability: GitHubReadAvailability | null;
  contributorsError: Error | null;
  showContributors: boolean;
  showSettings: boolean;
  onOpenReleasesTab(): void;
  onOpenContributorsTab(): void;
  onOpenSettingsTab(): void;
  onOpenRelease(release: ReleaseSummary): void;
  onOpenContributor(contributor: ContributorSummary): void;
  onOpenExternal(url: string): void;
}): JSX.Element {
  const languages = repository ? normalizeLanguageStats(repository) : [];
  const counts = repository
    ? getRepositoryCounts(repository, { issues: [], pulls: [], discussions: [], projects: [], releases })
    : null;
  const visibleReleases = releases.slice(0, 2);
  const visibleContributors = contributors.slice(0, 12);
  const visibleTopics = repository?.topics.slice(0, 8) ?? [];
  const hiddenTopicCount = Math.max(0, (repository?.topics.length ?? 0) - visibleTopics.length);
  const releasesAvailabilityMessage = readAvailabilityMessage("Releases", releasesAvailability);
  const contributorsAvailabilityMessage = readAvailabilityMessage("Contributors", contributorsAvailability);

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
        {repository && showSettings && (
          <button className="rail-inline-action" type="button" onClick={onOpenSettingsTab}>
            Repository settings
          </button>
        )}
        {visibleTopics.length > 0 && (
          <>
            <div className="topic-wrap">
              {visibleTopics.map((topic) => (
                <span key={topic}>{topic}</span>
              ))}
            </div>
            {hiddenTopicCount > 0 && (
              <small className="rail-muted">Showing 8 of {repository?.topics.length} topics.</small>
            )}
          </>
        )}
        <ul className="about-list">
          {repository?.visibility && (
            <li>
              <Lock size={15} /> {repository.visibility.toLowerCase()}
            </li>
          )}
          {repository?.defaultBranch && (
            <li>
              <GitBranch size={15} /> {repository.defaultBranch}
            </li>
          )}
          {repository?.permissions.isArchived && (
            <li>
              <Settings size={15} /> Archived
            </li>
          )}
          {repository?.permissions.isDisabled && (
            <li>
              <Settings size={15} /> Disabled
            </li>
          )}
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
          {repository ? (
            languages.length > 0 && <span>{languageTotalLabel(languages) ?? `${languages.length}`}</span>
          ) : (
            <span>loading</span>
          )}
        </div>
        {!repository ? (
          <small className="rail-muted">Loading language data…</small>
        ) : languages.length > 0 ? (
          <>
            <div className="language-bar" aria-label="Repository language breakdown">
              {languages.map((language) => (
                <span
                  key={language.name}
                  style={{
                    background: language.color ?? "#94a3b8",
                    width: `${Math.max(1, language.percent)}%`
                  }}
                />
              ))}
            </div>
            <div className="language-list">
              {languages.slice(0, 8).map((language) => (
                <div key={language.name}>
                  <span style={{ background: language.color ?? "#94a3b8" }} />
                  <strong>{language.name}</strong>
                  <small>{`${language.percent.toFixed(1)}%`}</small>
                </div>
              ))}
            </div>
          </>
        ) : (
          <small className="rail-muted">GitHub returned no language data for this repository.</small>
        )}
      </section>

      {showReleases && (
        <section className="rail-panel">
          <div className="rail-heading">
            <h3>Releases</h3>
            <div className="rail-heading-actions">
              <span>{releasesLoading ? "updating" : releases.length}</span>
            </div>
          </div>
          {releasesLoading && releases.length === 0 && (
            <small className="rail-muted">Loading releases…</small>
          )}
          {releasesError && (
            <small className="rail-error">Releases unavailable: {releasesError.message}</small>
          )}
          {releasesAvailabilityMessage && <small className="rail-error">{releasesAvailabilityMessage}</small>}
          {releases.length > 0 && (
            <button className="rail-inline-action" type="button" onClick={onOpenReleasesTab}>
              View all releases
            </button>
          )}
          {releases.length > visibleReleases.length && (
            <small className="rail-muted">
              Showing first {visibleReleases.length} of {releases.length} releases.
            </small>
          )}
          {visibleReleases.map((release) => (
            <button
              className="release-row"
              key={release.id}
              type="button"
              onClick={() => onOpenRelease(release)}
            >
              <Tag size={17} />
              <span>
                <strong>{release.name ?? release.tagName}</strong>
                <small>{formatRelativeDate(release.publishedAt)}</small>
              </span>
            </button>
          ))}
          {!releasesLoading && !releasesError && !releasesAvailabilityMessage && releases.length === 0 && (
            <small className="rail-muted">GitHub returned no releases for this repository.</small>
          )}
        </section>
      )}

      {showContributors && (
        <section className="rail-panel">
          <div className="rail-heading">
            <h3>Contributors</h3>
            <div className="rail-heading-actions">
              <span>{contributorsLoading ? "updating" : contributors.length}</span>
            </div>
          </div>
          {contributorsLoading && contributors.length === 0 && (
            <small className="rail-muted">Loading contributors…</small>
          )}
          {contributorsError && (
            <small className="rail-error">Contributors unavailable: {contributorsError.message}</small>
          )}
          {contributorsAvailabilityMessage && (
            <small className="rail-error">{contributorsAvailabilityMessage}</small>
          )}
          {contributors.length > 0 && (
            <button className="rail-inline-action" type="button" onClick={onOpenContributorsTab}>
              View all contributors
            </button>
          )}
          {contributors.length > visibleContributors.length && (
            <small className="rail-muted">
              Showing first {visibleContributors.length} of {contributors.length} contributors.
            </small>
          )}
          <div className="contributors">
            {visibleContributors.map((contributor) => (
              <div className="contributor-row-shell" key={`${contributor.id}-${contributor.login}`}>
                <button
                  className="contributor-row"
                  type="button"
                  title={`View ${contributor.login} in Control`}
                  onClick={() => onOpenContributor(contributor)}
                >
                  {contributor.avatarUrl ? <img src={contributor.avatarUrl} alt="" /> : null}
                  <span>
                    <strong>{contributor.login}</strong>
                    <small>{formatCompactNumber(contributor.contributions)} contributions</small>
                  </span>
                </button>
              </div>
            ))}
          </div>
          {!contributorsLoading &&
            !contributorsError &&
            !contributorsAvailabilityMessage &&
            contributors.length === 0 && (
              <small className="rail-muted">GitHub returned no contributors for this repository.</small>
            )}
        </section>
      )}
    </aside>
  );
}
