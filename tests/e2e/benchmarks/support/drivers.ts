import { expect } from "@playwright/test";
import { _electron as electron, type ElectronApplication, type Locator, type Page } from "playwright";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import type { ProviderFixture, RunTarget } from "./types";

export interface RepositoryObservationData {
  nameWithOwner: string;
  heading: string | null;
  fileCount: number;
  readmeVisible: boolean;
}

export interface ThreadObservationData {
  nameWithOwner: string;
  number: number;
  title: string;
  count: number;
}

export interface FileObservationData {
  nameWithOwner: string;
  path: string;
  heading: string | null;
  contentVisible: boolean;
  fileCount: number;
}

export interface ReleaseObservationData {
  nameWithOwner: string;
  releaseCount: number;
  firstReleaseTitle: string | null;
}

export interface ActionsObservationData {
  nameWithOwner: string;
  runCount: number;
  firstRunTitle: string | null;
}

export interface DiscussionsObservationData {
  nameWithOwner: string;
  discussionCount: number;
  firstDiscussionTitle: string | null;
  unavailableVisible: boolean;
}

export interface ProjectsObservationData {
  nameWithOwner: string;
  projectCount: number;
  firstProjectTitle: string | null;
  unavailableVisible: boolean;
}

export interface RefObservationData {
  nameWithOwner: string;
  selectedRef: string | null;
  branchCount: number;
  tagCount: number;
  firstBranchName: string | null;
  firstTagName: string | null;
}

export interface NotificationsObservationData {
  scope: "account";
  notificationCount: number;
  firstNotificationTitle: string | null;
  unreadCount: number;
  participatingVisible: boolean;
  unavailableVisible: boolean;
}

export interface RepositoryAdminObservationData {
  nameWithOwner: string;
  heading: string | null;
  defaultBranchVisible: boolean;
  featureCount: number;
  mergePolicyCount: number;
  permissionSummaryVisible: boolean;
  unavailableVisible: boolean;
}

export interface OrganizationsObservationData {
  scope: "account";
  organizationCount: number;
  firstOrganizationName: string | null;
  teamCount: number;
  firstTeamName: string | null;
  membershipSummaryVisible: boolean;
  unavailableVisible: boolean;
}

export interface ContributorsObservationData {
  nameWithOwner: string;
  contributorCount: number;
  firstContributorLogin: string | null;
  unavailableVisible: boolean;
}

export interface SecurityQualityObservationData {
  nameWithOwner: string;
  branchProtectionVisible: boolean;
  dependabotVisible: boolean;
  codeScanningVisible: boolean;
  secretScanningVisible: boolean;
  qualityLinkCount: number;
  unavailableVisible: boolean;
}

export interface ActionRunObservationData {
  nameWithOwner: string;
  title: string | null;
  jobCount: number;
  logsVisible: boolean;
  artifactsVisible: boolean;
}

export interface BenchmarkDriver {
  readonly target: RunTarget;
  searchRepository(fixture: ProviderFixture): Promise<void>;
  openRepository(fixture: ProviderFixture): Promise<void>;
  waitForRepositoryHeader(fixture: ProviderFixture): Promise<void>;
  waitForFileList(): Promise<void>;
  waitForReadme(): Promise<void>;
  observeRepository(fixture: ProviderFixture): Promise<RepositoryObservationData>;
  openIssues(fixture: ProviderFixture): Promise<void>;
  openFirstIssue(fixture: ProviderFixture): Promise<ThreadObservationData>;
  openPullRequests(fixture: ProviderFixture): Promise<void>;
  openFirstPullRequest(fixture: ProviderFixture): Promise<ThreadObservationData>;
  openReadmeFile(fixture: ProviderFixture): Promise<void>;
  observeFile(fixture: ProviderFixture): Promise<FileObservationData>;
  openReleases(fixture: ProviderFixture): Promise<void>;
  observeReleases(fixture: ProviderFixture): Promise<ReleaseObservationData>;
  openDiscussions(fixture: ProviderFixture): Promise<void>;
  observeDiscussions(fixture: ProviderFixture): Promise<DiscussionsObservationData>;
  openProjects(fixture: ProviderFixture): Promise<void>;
  observeProjects(fixture: ProviderFixture): Promise<ProjectsObservationData>;
  openRefs(fixture: ProviderFixture): Promise<void>;
  observeRefs(fixture: ProviderFixture): Promise<RefObservationData>;
  openNotifications(fixture: ProviderFixture): Promise<void>;
  observeNotifications(fixture: ProviderFixture): Promise<NotificationsObservationData>;
  openRepositoryAdministration(fixture: ProviderFixture): Promise<void>;
  observeRepositoryAdministration(fixture: ProviderFixture): Promise<RepositoryAdminObservationData>;
  openOrganizations(fixture: ProviderFixture): Promise<void>;
  openOrganizationTeams(fixture: ProviderFixture): Promise<void>;
  observeOrganizations(fixture: ProviderFixture): Promise<OrganizationsObservationData>;
  openContributors(fixture: ProviderFixture): Promise<void>;
  observeContributors(fixture: ProviderFixture): Promise<ContributorsObservationData>;
  openSecurityQuality(fixture: ProviderFixture): Promise<void>;
  observeSecurityQuality(fixture: ProviderFixture): Promise<SecurityQualityObservationData>;
  openActions(fixture: ProviderFixture): Promise<void>;
  observeActions(fixture: ProviderFixture): Promise<ActionsObservationData>;
  openFirstActionRun(fixture: ProviderFixture): Promise<void>;
  observeActionRun(fixture: ProviderFixture): Promise<ActionRunObservationData>;
  screenshot(path: string): Promise<void>;
  close(): Promise<string[]>;
}

export class GitHubWebDriver implements BenchmarkDriver {
  readonly target = "github-web" as const;

  constructor(private readonly page: Page) {}

  async searchRepository(): Promise<void> {
    // GitHub web uses direct, canonical URLs. Keep this metric as a no-op so
    // Control's search latency can be analyzed separately.
  }

  async openRepository(fixture: ProviderFixture): Promise<void> {
    await this.page.goto(`https://github.com/${fixture.owner}/${fixture.repo}`, {
      waitUntil: "domcontentloaded"
    });
    await this.waitForRepositoryHeader(fixture);
  }

  async waitForRepositoryHeader(fixture: ProviderFixture): Promise<void> {
    await this.page
      .locator("#repository-container-header, [data-testid='repository-container-header']")
      .first()
      .waitFor({ state: "visible", timeout: 30_000 });
    await this.page.getByRole("link", { name: fixture.repo, exact: true }).first().waitFor({
      state: "visible",
      timeout: 30_000
    });
  }

  async waitForFileList(): Promise<void> {
    await this.page.waitForFunction(() =>
      [...document.querySelectorAll<HTMLAnchorElement>("a[href*='/blob/'], a[href*='/tree/']")].some(
        (anchor) => anchor.getClientRects().length > 0
      )
    );
  }

  async waitForReadme(): Promise<void> {
    await this.page.getByRole("link", { name: /readme/i }).first().waitFor({ state: "visible" });
  }

  async observeRepository(fixture: ProviderFixture): Promise<RepositoryObservationData> {
    return {
      nameWithOwner: fixture.nameWithOwner,
      heading: await visibleText(this.page.locator("#repository-container-header").first()),
      fileCount: await countRepoLinks(this.page, fixture),
      readmeVisible: (await this.page.getByRole("link", { name: /readme/i }).count()) > 0
    };
  }

  async openIssues(fixture: ProviderFixture): Promise<void> {
    await this.page.goto(`https://github.com/${fixture.owner}/${fixture.repo}/issues?q=is%3Aissue%20state%3Aopen`, {
      waitUntil: "domcontentloaded"
    });
    await this.page.locator("a[href*='/issues/']").first().waitFor({
      state: "visible",
      timeout: 30_000
    });
  }

  async openFirstIssue(fixture: ProviderFixture): Promise<ThreadObservationData> {
    const item = await firstGitHubThreadLink(this.page, fixture, "issues");
    await this.page.goto(item.href, { waitUntil: "domcontentloaded" });
    await expect(this.page).toHaveURL(new RegExp(`/issues/${item.number}(?:$|[?#])`));
    await this.page.getByText(`#${item.number}`).first().waitFor({ state: "visible", timeout: 30_000 });
    return {
      nameWithOwner: fixture.nameWithOwner,
      number: item.number,
      title: item.title,
      count: await this.page.locator("[data-testid='issue-comment'], .js-comment-container").count()
    };
  }

  async openPullRequests(fixture: ProviderFixture): Promise<void> {
    await this.page.goto(`https://github.com/${fixture.owner}/${fixture.repo}/pulls?q=is%3Apr%20state%3Aopen`, {
      waitUntil: "domcontentloaded"
    });
    await this.page.locator("a[href*='/pull/']").first().waitFor({
      state: "visible",
      timeout: 30_000
    });
  }

  async openFirstPullRequest(fixture: ProviderFixture): Promise<ThreadObservationData> {
    const item = await firstGitHubThreadLink(this.page, fixture, "pull");
    await this.page.goto(item.href, { waitUntil: "domcontentloaded" });
    await expect(this.page).toHaveURL(new RegExp(`/pull/${item.number}(?:$|[?#])`));
    await this.page.getByText(`#${item.number}`).first().waitFor({ state: "visible", timeout: 30_000 });
    return {
      nameWithOwner: fixture.nameWithOwner,
      number: item.number,
      title: item.title,
      count: await this.page.locator("[data-testid='issue-comment'], .js-comment-container").count()
    };
  }

  async openReadmeFile(fixture: ProviderFixture): Promise<void> {
    const repoPath = await currentGitHubRepoPath(this.page, fixture);
    const href = await this.page.evaluate(({ owner, repo }) => {
      const anchors = [...document.querySelectorAll<HTMLAnchorElement>("a[href*='/blob/']")];
      return anchors.find((anchor) => anchor.href.includes(`/${owner}/${repo}/blob/`) && /README\.md$/i.test(anchor.href))
        ?.href ?? null;
    }, repoPath);

    if (!href) {
      throw new Error(`README.md link was not found for ${fixture.nameWithOwner}.`);
    }

    await this.page.goto(href, { waitUntil: "domcontentloaded" });
    await this.page.getByText("README.md").first().waitFor({ state: "visible", timeout: 30_000 });
  }

  async observeFile(fixture: ProviderFixture): Promise<FileObservationData> {
    return {
      nameWithOwner: fixture.nameWithOwner,
      path: "README.md",
      heading: await visibleText(this.page.getByText("README.md").first()),
      contentVisible: (await this.page.locator("article, .react-file-view, .blob-wrapper").count()) > 0,
      fileCount: await countRepoLinks(this.page, fixture)
    };
  }

  async openReleases(fixture: ProviderFixture): Promise<void> {
    await this.page.goto(`https://github.com/${fixture.owner}/${fixture.repo}/releases`, {
      waitUntil: "domcontentloaded"
    });
    await this.page.getByRole("heading", { name: /releases/i }).first().waitFor({
      state: "visible",
      timeout: 30_000
    });
  }

  async observeReleases(fixture: ProviderFixture): Promise<ReleaseObservationData> {
    const repoPath = await currentGitHubRepoPath(this.page, fixture);
    const releases = this.page.locator(`a[href*='/${repoPath.owner}/${repoPath.repo}/releases/tag/']`);
    return {
      nameWithOwner: fixture.nameWithOwner,
      releaseCount: await releases.count(),
      firstReleaseTitle: await visibleText(releases.first())
    };
  }

  async openDiscussions(fixture: ProviderFixture): Promise<void> {
    await this.page.goto(`https://github.com/${fixture.owner}/${fixture.repo}/discussions`, {
      waitUntil: "domcontentloaded"
    });
    await this.page.locator("body").waitFor({ state: "visible", timeout: 30_000 });
    await this.page.waitForFunction(() => /discussion|not found|disabled/i.test(document.body.innerText), null, {
      timeout: 30_000
    });
  }

  async observeDiscussions(fixture: ProviderFixture): Promise<DiscussionsObservationData> {
    const repoPath = await currentGitHubRepoPath(this.page, fixture);
    const discussions = this.page.locator(`a[href*='/${repoPath.owner}/${repoPath.repo}/discussions/']`);
    return {
      nameWithOwner: fixture.nameWithOwner,
      discussionCount: await discussions.count(),
      firstDiscussionTitle: await visibleText(discussions.first()),
      unavailableVisible: (await this.page.getByText(/discussion.*disabled|not found/i).count()) > 0
    };
  }

  async openProjects(fixture: ProviderFixture): Promise<void> {
    await this.page.goto(`https://github.com/${fixture.owner}/${fixture.repo}/projects`, {
      waitUntil: "domcontentloaded"
    });
    await this.page.locator("body").waitFor({ state: "visible", timeout: 30_000 });
    await this.page.waitForFunction(() => /projects?|not found|disabled|access/i.test(document.body.innerText), null, {
      timeout: 30_000
    });
  }

  async observeProjects(fixture: ProviderFixture): Promise<ProjectsObservationData> {
    const repoPath = await currentGitHubRepoPath(this.page, fixture);
    const projects = this.page.locator(
      `a[href*='/${repoPath.owner}/${repoPath.repo}/projects/'], a[href*='/orgs/${repoPath.owner}/projects/']`
    );
    return {
      nameWithOwner: fixture.nameWithOwner,
      projectCount: await projects.count(),
      firstProjectTitle: await visibleText(projects.first()),
      unavailableVisible: (await this.page.getByText(/projects?.*(disabled|not enabled|access|not found)/i).count()) > 0
    };
  }

  async openRefs(fixture: ProviderFixture): Promise<void> {
    await this.page.goto(`https://github.com/${fixture.owner}/${fixture.repo}/branches/all`, {
      waitUntil: "domcontentloaded"
    });
    await this.page.getByRole("heading", { name: /branches/i }).first().waitFor({
      state: "visible",
      timeout: 30_000
    });
  }

  async observeRefs(fixture: ProviderFixture): Promise<RefObservationData> {
    const repoPath = await currentGitHubRepoPath(this.page, fixture);
    const branchLinks = this.page.locator(`a[href*='/${repoPath.owner}/${repoPath.repo}/tree/']`);
    const branchCount = await branchLinks.count();
    const firstBranchName = await visibleText(branchLinks.first());

    await this.page.goto(`https://github.com/${repoPath.owner}/${repoPath.repo}/tags`, {
      waitUntil: "domcontentloaded"
    });
    await this.page.getByRole("heading", { name: /tags/i }).first().waitFor({
      state: "visible",
      timeout: 30_000
    });
    const tagLinks = this.page.locator(
      `a[href*='/${repoPath.owner}/${repoPath.repo}/releases/tag/'], a[href*='/${repoPath.owner}/${repoPath.repo}/tree/']`
    );

    return {
      nameWithOwner: fixture.nameWithOwner,
      selectedRef: null,
      branchCount,
      tagCount: await tagLinks.count(),
      firstBranchName,
      firstTagName: await visibleText(tagLinks.first())
    };
  }

  async openNotifications(): Promise<void> {
    await this.page.goto("https://github.com/notifications", {
      waitUntil: "domcontentloaded"
    });
    await this.page.locator("body").waitFor({ state: "visible", timeout: 30_000 });
    await this.page.waitForFunction(
      () => /notifications|inbox|unread|sign in|sign-in|forbidden/i.test(document.body.innerText),
      null,
      { timeout: 30_000 }
    );
  }

  async observeNotifications(): Promise<NotificationsObservationData> {
    const data = await this.page.evaluate(() => {
      const links = [...document.querySelectorAll<HTMLAnchorElement>("a[href]")];
      const subjectLinks = links
        .filter((link) =>
          /\/(?:issues|pull|discussions)\/\d+(?:$|[?#])|\/releases\/tag\//.test(new URL(link.href).pathname)
        )
        .filter((link) => link.getClientRects().length > 0);
      const uniqueSubjectHrefs = new Set(subjectLinks.map((link) => link.href));
      const firstSubjectTitle =
        subjectLinks
          .map((link) => link.textContent?.trim().replace(/\s+/g, " ") ?? "")
          .find((text) => text.length > 0) ?? null;
      const unreadCount = [...document.querySelectorAll("[aria-label], .unread")]
        .filter((element) => /unread/i.test(element.getAttribute("aria-label") ?? element.className.toString()))
        .filter((element) => element.getClientRects().length > 0).length;

      return {
        bodyText: document.body.innerText,
        firstSubjectTitle,
        notificationCount: uniqueSubjectHrefs.size,
        unreadCount
      };
    });

    return {
      scope: "account",
      notificationCount: data.notificationCount,
      firstNotificationTitle: data.firstSubjectTitle,
      unreadCount: data.unreadCount,
      participatingVisible: /participating/i.test(data.bodyText),
      unavailableVisible: /sign in|sign-in|forbidden|permission|error|could not/i.test(data.bodyText)
    };
  }

  async openRepositoryAdministration(fixture: ProviderFixture): Promise<void> {
    await this.page.goto(`https://github.com/${fixture.owner}/${fixture.repo}/settings`, {
      waitUntil: "domcontentloaded"
    });
    await this.page.locator("body").waitFor({ state: "visible", timeout: 30_000 });
    await this.page.waitForFunction(
      () => /settings|options|default branch|not found|sign in|access|permission/i.test(document.body.innerText),
      null,
      { timeout: 30_000 }
    );
  }

  async observeRepositoryAdministration(fixture: ProviderFixture): Promise<RepositoryAdminObservationData> {
    const data = await this.page.evaluate(() => {
      const bodyText = document.body.innerText;
      const normalized = bodyText.toLowerCase();
      const featureTerms = ["issues", "projects", "wiki", "discussions"];
      const mergeTerms = ["merge commit", "squash", "rebase", "auto-merge", "delete branch"];
      return {
        bodyText,
        heading: document.querySelector("h1, h2")?.textContent?.trim().replace(/\s+/g, " ") ?? null,
        defaultBranchVisible: normalized.includes("default branch"),
        featureCount: featureTerms.filter((term) => normalized.includes(term)).length,
        mergePolicyCount: mergeTerms.filter((term) => normalized.includes(term)).length,
        permissionSummaryVisible:
          normalized.includes("collaborators") ||
          normalized.includes("manage access") ||
          normalized.includes("access") ||
          normalized.includes("permissions")
      };
    });

    return {
      nameWithOwner: fixture.nameWithOwner,
      heading: data.heading,
      defaultBranchVisible: data.defaultBranchVisible,
      featureCount: data.featureCount,
      mergePolicyCount: data.mergePolicyCount,
      permissionSummaryVisible: data.permissionSummaryVisible,
      unavailableVisible: /not found|sign in|sign-in|forbidden|permission|access denied/i.test(data.bodyText)
    };
  }

  async openOrganizations(): Promise<void> {
    await this.page.goto("https://github.com/settings/organizations", {
      waitUntil: "domcontentloaded"
    });
    await this.page.locator("body").waitFor({ state: "visible", timeout: 30_000 });
    await this.page.waitForFunction(
      () => /organizations|owned organizations|member organizations|sign in|sign-in|access|permission/i.test(document.body.innerText),
      null,
      { timeout: 30_000 }
    );
  }

  async openOrganizationTeams(fixture: ProviderFixture): Promise<void> {
    await this.page.goto(`https://github.com/orgs/${fixture.owner}/teams`, {
      waitUntil: "domcontentloaded"
    });
    await this.page.locator("body").waitFor({ state: "visible", timeout: 30_000 });
    await this.page.waitForFunction(
      () => /teams|not found|sign in|sign-in|access|permission/i.test(document.body.innerText),
      null,
      { timeout: 30_000 }
    );
  }

  async observeOrganizations(fixture: ProviderFixture): Promise<OrganizationsObservationData> {
    const data = await this.page.evaluate((owner) => {
      const bodyText = document.body.innerText;
      const links = [...document.querySelectorAll<HTMLAnchorElement>("a[href]")];
      const organizationLinks = links
        .filter((link) => {
          const pathname = new URL(link.href).pathname;
          return /^\/(?:orgs\/)?[A-Za-z0-9_.-]+\/?$/.test(pathname) && !pathname.includes("/settings");
        })
        .filter((link) => link.getClientRects().length > 0);
      const teamLinks = links
        .filter((link) => new URL(link.href).pathname.startsWith(`/orgs/${owner}/teams/`))
        .filter((link) => link.getClientRects().length > 0);
      const uniqueOrganizations = new Map(
        organizationLinks.map((link) => [new URL(link.href).pathname, link.textContent?.trim().replace(/\s+/g, " ") ?? ""])
      );
      const uniqueTeams = new Map(
        teamLinks.map((link) => [new URL(link.href).pathname, link.textContent?.trim().replace(/\s+/g, " ") ?? ""])
      );

      return {
        bodyText,
        firstOrganizationName: [...uniqueOrganizations.values()].find((name) => name.length > 0) ?? null,
        firstTeamName: [...uniqueTeams.values()].find((name) => name.length > 0) ?? null,
        organizationCount: uniqueOrganizations.size,
        teamCount: uniqueTeams.size
      };
    }, fixture.owner);

    return {
      scope: "account",
      organizationCount: data.organizationCount,
      firstOrganizationName: data.firstOrganizationName,
      teamCount: data.teamCount,
      firstTeamName: data.firstTeamName,
      membershipSummaryVisible: /member|owner|admin|role|organization/i.test(data.bodyText),
      unavailableVisible: /not found|sign in|sign-in|forbidden|permission|access denied/i.test(data.bodyText)
    };
  }

  async openContributors(fixture: ProviderFixture): Promise<void> {
    await this.page.goto(`https://github.com/${fixture.owner}/${fixture.repo}/graphs/contributors`, {
      waitUntil: "domcontentloaded"
    });
    await this.page.locator("body").waitFor({ state: "visible", timeout: 30_000 });
    await this.page.waitForFunction(
      () => /contributors|contribution|not found|sign in|sign-in|access|permission/i.test(document.body.innerText),
      null,
      { timeout: 30_000 }
    );
  }

  async observeContributors(fixture: ProviderFixture): Promise<ContributorsObservationData> {
    const data = await this.page.evaluate(() => {
      const bodyText = document.body.innerText;
      const imageLogins = [...document.querySelectorAll<HTMLImageElement>("img[alt^='@']")]
        .map((image) => image.alt.replace(/^@/, "").trim())
        .filter(Boolean);
      const hovercardLogins = [...document.querySelectorAll<HTMLAnchorElement>("a[data-hovercard-type='user']")]
        .map((link) => new URL(link.href).pathname.split("/").filter(Boolean)[0] ?? "")
        .filter(Boolean);
      const uniqueLogins = [...new Set([...imageLogins, ...hovercardLogins])];

      return {
        bodyText,
        contributorCount: uniqueLogins.length,
        firstContributorLogin: uniqueLogins[0] ?? null
      };
    });

    return {
      nameWithOwner: fixture.nameWithOwner,
      contributorCount: data.contributorCount,
      firstContributorLogin: data.firstContributorLogin,
      unavailableVisible: /not found|sign in|sign-in|forbidden|permission|access denied/i.test(data.bodyText)
    };
  }

  async openSecurityQuality(fixture: ProviderFixture): Promise<void> {
    await this.page.goto(`https://github.com/${fixture.owner}/${fixture.repo}/security`, {
      waitUntil: "domcontentloaded"
    });
    await this.page.locator("body").waitFor({ state: "visible", timeout: 30_000 });
    await this.page.waitForFunction(
      () =>
        /security|dependabot|code scanning|secret scanning|branch protection|not found|sign in|access|permission/i.test(
          document.body.innerText
        ),
      null,
      { timeout: 30_000 }
    );
  }

  async observeSecurityQuality(fixture: ProviderFixture): Promise<SecurityQualityObservationData> {
    const data = await this.page.evaluate(() => {
      const bodyText = document.body.innerText;
      const normalized = bodyText.toLowerCase();
      const qualityLinks = [...document.querySelectorAll<HTMLAnchorElement>("a[href*='/security'], a[href*='/community'], a[href*='/pulse']")]
        .filter((link) => link.getClientRects().length > 0)
        .map((link) => link.href);

      return {
        bodyText,
        branchProtectionVisible: normalized.includes("branch protection") || normalized.includes("ruleset"),
        dependabotVisible: normalized.includes("dependabot"),
        codeScanningVisible: normalized.includes("code scanning"),
        secretScanningVisible: normalized.includes("secret scanning"),
        qualityLinkCount: new Set(qualityLinks).size
      };
    });

    return {
      nameWithOwner: fixture.nameWithOwner,
      branchProtectionVisible: data.branchProtectionVisible,
      dependabotVisible: data.dependabotVisible,
      codeScanningVisible: data.codeScanningVisible,
      secretScanningVisible: data.secretScanningVisible,
      qualityLinkCount: data.qualityLinkCount,
      unavailableVisible: /not found|sign in|sign-in|forbidden|permission|access denied/i.test(data.bodyText)
    };
  }

  async openActions(fixture: ProviderFixture): Promise<void> {
    await this.page.goto(`https://github.com/${fixture.owner}/${fixture.repo}/actions`, {
      waitUntil: "domcontentloaded"
    });
    await this.page.getByRole("heading", { name: /actions|workflows/i }).first().waitFor({
      state: "visible",
      timeout: 30_000
    });
  }

  async observeActions(fixture: ProviderFixture): Promise<ActionsObservationData> {
    const repoPath = await currentGitHubRepoPath(this.page, fixture);
    const runs = this.page.locator(`a[href*='/${repoPath.owner}/${repoPath.repo}/actions/runs/']`);
    return {
      nameWithOwner: fixture.nameWithOwner,
      runCount: await runs.count(),
      firstRunTitle: await visibleText(runs.first())
    };
  }

  async openFirstActionRun(fixture: ProviderFixture): Promise<void> {
    const item = await firstGitHubActionRunLink(this.page, fixture);
    await this.page.goto(item.href, { waitUntil: "domcontentloaded" });
    await expect(this.page).toHaveURL(new RegExp(`/actions/runs/${item.id}(?:$|[?#/])`));
  }

  async observeActionRun(fixture: ProviderFixture): Promise<ActionRunObservationData> {
    const repoPath = await currentGitHubRepoPath(this.page, fixture);
    return {
      nameWithOwner: fixture.nameWithOwner,
      title: await visibleText(this.page.locator("h1, h2").first()),
      jobCount: await this.page.locator(`a[href*='/${repoPath.owner}/${repoPath.repo}/actions/runs/'][href*='/job/']`).count(),
      logsVisible: (await this.page.getByText(/logs/i).count()) > 0,
      artifactsVisible: (await this.page.getByText(/artifacts/i).count()) > 0
    };
  }

  async screenshot(path: string): Promise<void> {
    await this.page.screenshot({ path, fullPage: true });
  }

  async close(): Promise<string[]> {
    return [];
  }
}

export interface ControlElectronLaunchOptions {
  rendererUrl: string;
  artifactDir: string;
  userDataDir: string;
}

export class ControlElectronDriver implements BenchmarkDriver {
  readonly target = "control-electron" as const;
  private pendingSearchResult: Locator | null = null;

  private constructor(
    private readonly app: ElectronApplication,
    private readonly page: Page,
    private readonly userDataDir: string,
    private readonly artifactDir: string
  ) {}

  static async launch(options: ControlElectronLaunchOptions): Promise<ControlElectronDriver> {
    mkdirSync(options.userDataDir, { recursive: true });
    const env = compactEnv({
      ...process.env,
      ELECTRON_RENDERER_URL: options.rendererUrl,
      CONTROL_USER_DATA_DIR: options.userDataDir,
      CONTROL_E2E: "1",
      CONTROL_GITHUB_TOKEN: readGhAuthToken()
    });
    delete env.ELECTRON_RUN_AS_NODE;

    const app = await electron.launch({
      args: [process.cwd()],
      env,
      timeout: 30_000
    });
    const page = await app.firstWindow({ timeout: 30_000 });
    await page.waitForLoadState("domcontentloaded", { timeout: 30_000 });
    if (page.url().startsWith("chrome-error://")) {
      throw new Error(`Control Electron could not load renderer URL ${options.rendererUrl}.`);
    }
    return new ControlElectronDriver(app, page, options.userDataDir, options.artifactDir);
  }

  async searchRepository(fixture: ProviderFixture): Promise<void> {
    const query = fixture.searchQuery ?? fixture.nameWithOwner;
    const searchInput = this.page.getByLabel("Search or jump to");
    await searchInput.fill(query);
    const result = this.page.locator(".search-popover button").filter({ hasText: query }).first();
    await result.waitFor({ state: "visible", timeout: 30_000 });
    this.pendingSearchResult = result;
  }

  async openRepository(fixture: ProviderFixture): Promise<void> {
    if (!this.pendingSearchResult || !(await this.pendingSearchResult.isVisible().catch(() => false))) {
      await this.searchRepository(fixture);
    }
    const result = this.pendingSearchResult;
    if (!result) {
      throw new Error(`Search result was not prepared for ${fixture.nameWithOwner}.`);
    }
    await result.click();
    this.pendingSearchResult = null;
    await this.waitForRepositoryHeader(fixture);
  }

  async waitForRepositoryHeader(fixture: ProviderFixture): Promise<void> {
    const owners = [fixture.owner, ...(fixture.aliases ?? []).map((alias) => alias.split("/")[0])];
    await this.page
      .getByRole("heading", {
        name: new RegExp(`(?:${owners.map(escapeRegExp).join("|")})\\s*/\\s*${escapeRegExp(fixture.repo)}`, "i")
      })
      .waitFor({ state: "visible", timeout: 45_000 });
  }

  async waitForFileList(): Promise<void> {
    await this.page.locator(".virtual-file-list .file-row").first().waitFor({ state: "visible", timeout: 45_000 });
  }

  async waitForReadme(): Promise<void> {
    await this.page.locator(".readme-panel").getByText("README.md").waitFor({ state: "visible", timeout: 45_000 });
  }

  async observeRepository(fixture: ProviderFixture): Promise<RepositoryObservationData> {
    return {
      nameWithOwner: fixture.nameWithOwner,
      heading: await visibleText(this.page.getByRole("heading", { level: 1 }).first()),
      fileCount: await this.page.locator(".virtual-file-list .file-row").count(),
      readmeVisible: (await this.page.locator(".readme-panel").getByText("README.md").count()) > 0
    };
  }

  async openIssues(): Promise<void> {
    await this.page.locator(".repo-tabs").getByRole("button", { name: /^Issues/ }).click();
    await this.page.locator(".thread-list .issue-row").first().waitFor({ state: "visible", timeout: 45_000 });
  }

  async openFirstIssue(fixture: ProviderFixture): Promise<ThreadObservationData> {
    const row = this.page.locator(".thread-list .issue-row").first();
    await row.click();
    const title = (await row.locator("strong").first().innerText()).trim();
    const small = await row.locator("small").first().innerText();
    const number = parseThreadNumber(small);
    await this.page.getByRole("heading", { name: title }).waitFor({ state: "visible", timeout: 45_000 });
    return {
      nameWithOwner: fixture.nameWithOwner,
      number,
      title,
      count: parseCount(small, /(\d+)\s+comments?/)
    };
  }

  async openPullRequests(): Promise<void> {
    await this.page.locator(".repo-tabs").getByRole("button", { name: /^Pull requests/ }).click();
    await this.page.locator(".thread-list .issue-row").first().waitFor({ state: "visible", timeout: 45_000 });
  }

  async openFirstPullRequest(fixture: ProviderFixture): Promise<ThreadObservationData> {
    const row = this.page.locator(".thread-list .issue-row").first();
    await row.click();
    const title = (await row.locator("strong").first().innerText()).trim();
    const small = await row.locator("small").first().innerText();
    const number = parseThreadNumber(small);
    await this.page.getByRole("heading", { name: title }).waitFor({ state: "visible", timeout: 45_000 });
    return {
      nameWithOwner: fixture.nameWithOwner,
      number,
      title,
      count: parseCount(small, /(\d+)\s+files?/)
    };
  }

  async openReadmeFile(): Promise<void> {
    await this.page.locator(".repo-tabs").getByRole("button", { name: /^Code/ }).click();
    await this.waitForFileList();
    await clickVirtualFile(this.page, /README\.md/i);
    await this.page.getByRole("heading", { name: "README.md" }).waitFor({ state: "visible", timeout: 45_000 });
    await this.page.locator(".code-viewer").waitFor({ state: "visible", timeout: 45_000 });
  }

  async observeFile(fixture: ProviderFixture): Promise<FileObservationData> {
    return {
      nameWithOwner: fixture.nameWithOwner,
      path: "README.md",
      heading: await visibleText(this.page.getByRole("heading", { name: "README.md" })),
      contentVisible: (await this.page.locator(".code-viewer").count()) > 0,
      fileCount: await this.page.locator(".virtual-file-list .file-row").count()
    };
  }

  async openReleases(): Promise<void> {
    await this.page.locator(".repo-tabs").getByRole("button", { name: /^Releases/ }).click();
    await this.page
      .locator(".thread-list .issue-row, .github-split .empty-state")
      .first()
      .waitFor({ state: "visible", timeout: 45_000 });
  }

  async observeReleases(fixture: ProviderFixture): Promise<ReleaseObservationData> {
    const releases = this.page.locator(".thread-list .issue-row");
    return {
      nameWithOwner: fixture.nameWithOwner,
      releaseCount: await releases.count(),
      firstReleaseTitle: await visibleText(releases.first().locator("strong").first())
    };
  }

  async openDiscussions(): Promise<void> {
    await this.page.locator(".repo-tabs").getByRole("button", { name: /^Discussions/ }).click();
    await this.page
      .locator(".thread-list .issue-row, .github-split .empty-state, .github-split .error-state")
      .first()
      .waitFor({ state: "visible", timeout: 45_000 });
  }

  async observeDiscussions(fixture: ProviderFixture): Promise<DiscussionsObservationData> {
    const discussions = this.page.locator(".thread-list .issue-row");
    return {
      nameWithOwner: fixture.nameWithOwner,
      discussionCount: await discussions.count(),
      firstDiscussionTitle: await visibleText(discussions.first().locator("strong").first()),
      unavailableVisible: (await this.page.locator(".github-split .error-state").count()) > 0
    };
  }

  async openProjects(): Promise<void> {
    await this.page.locator(".repo-tabs").getByRole("button", { name: /^Projects/ }).click();
    await this.page
      .locator(".thread-list .issue-row, .github-split .empty-state, .github-split .error-state")
      .first()
      .waitFor({ state: "visible", timeout: 45_000 });
  }

  async observeProjects(fixture: ProviderFixture): Promise<ProjectsObservationData> {
    const projects = this.page.locator(".thread-list .issue-row");
    return {
      nameWithOwner: fixture.nameWithOwner,
      projectCount: await projects.count(),
      firstProjectTitle: await visibleText(projects.first().locator("strong").first()),
      unavailableVisible: (await this.page.locator(".github-split .error-state").count()) > 0
    };
  }

  async openRefs(): Promise<void> {
    await this.page.locator(".repo-tabs").getByRole("button", { name: /^Code/ }).click();
    await this.page.getByLabel("Code reference").waitFor({ state: "visible", timeout: 45_000 });
    await this.page
      .locator("select[aria-label='Code reference'] option")
      .nth(1)
      .waitFor({ state: "attached", timeout: 45_000 });
  }

  async observeRefs(fixture: ProviderFixture): Promise<RefObservationData> {
    const select = this.page.locator("select[aria-label='Code reference']");
    const branchOptions = select.locator("optgroup[label='Branches'] option");
    const tagOptions = select.locator("optgroup[label='Tags'] option");

    return {
      nameWithOwner: fixture.nameWithOwner,
      selectedRef: await select.inputValue(),
      branchCount: await branchOptions.count(),
      tagCount: await tagOptions.count(),
      firstBranchName: await optionLabel(branchOptions.first()),
      firstTagName: await optionLabel(tagOptions.first())
    };
  }

  async openNotifications(): Promise<void> {
    await this.page.getByRole("button", { name: /^Mailbox/ }).click();
    await this.page.getByRole("heading", { name: "Mailbox" }).waitFor({ state: "visible", timeout: 45_000 });
    await this.page
      .locator(".notification-row, .collection-view .empty-state, .collection-view .error-state")
      .first()
      .waitFor({ state: "visible", timeout: 45_000 });
  }

  async observeNotifications(): Promise<NotificationsObservationData> {
    const notifications = this.page.locator(".notification-row");
    return {
      scope: "account",
      notificationCount: await notifications.count(),
      firstNotificationTitle: await visibleText(notifications.first().locator("strong").first()),
      unreadCount: await this.page.locator(".notification-row.unread-row").count(),
      participatingVisible: (await this.page.getByText(/participating/i).count()) > 0,
      unavailableVisible: (await this.page.locator(".collection-view .error-state").count()) > 0
    };
  }

  async openRepositoryAdministration(): Promise<void> {
    await this.page.getByTitle("Repository settings").click();
    await this.page
      .getByRole("heading", { name: "Repository settings" })
      .waitFor({ state: "visible", timeout: 45_000 });
  }

  async observeRepositoryAdministration(fixture: ProviderFixture): Promise<RepositoryAdminObservationData> {
    const panel = this.page.locator(".repository-settings-panel");
    return {
      nameWithOwner: fixture.nameWithOwner,
      heading: await visibleText(panel.getByRole("heading", { name: "Repository settings" })),
      defaultBranchVisible: (await panel.getByText(/default branch/i).count()) > 0,
      featureCount: await panel.locator(".settings-list-grid section").filter({ hasText: "Features" }).locator("div").count(),
      mergePolicyCount: await panel
        .locator(".settings-list-grid section")
        .filter({ hasText: "Merge policy" })
        .locator("div")
        .count(),
      permissionSummaryVisible: (await panel.getByRole("heading", { name: "Your access" }).count()) > 0,
      unavailableVisible: (await panel.locator(".error-state").count()) > 0
    };
  }

  async openOrganizations(): Promise<void> {
    await this.page.getByRole("button", { name: /^Organizations/ }).click();
    await this.page.getByRole("heading", { name: "Organizations" }).waitFor({ state: "visible", timeout: 45_000 });
    await this.page
      .locator(".organization-row, .collection-view .empty-state, .collection-view .error-state")
      .first()
      .waitFor({ state: "visible", timeout: 45_000 });
  }

  async openOrganizationTeams(): Promise<void> {
    await this.page
      .locator(".organization-team-row, .collection-view .empty-state, .collection-view .error-state")
      .first()
      .waitFor({ state: "visible", timeout: 45_000 });
  }

  async observeOrganizations(): Promise<OrganizationsObservationData> {
    const organizations = this.page.locator(".organization-row");
    const teams = this.page.locator(".organization-team-row");
    return {
      scope: "account",
      organizationCount: await organizations.count(),
      firstOrganizationName: await visibleText(organizations.first().locator("strong").first()),
      teamCount: await teams.count(),
      firstTeamName: await visibleText(teams.first().locator("strong").first()),
      membershipSummaryVisible: (await this.page.getByText(/repositories.*teams.*(?:admin|member|visible)/i).count()) > 0,
      unavailableVisible: (await this.page.locator(".collection-view .error-state").count()) > 0
    };
  }

  async openContributors(): Promise<void> {
    await this.page.locator(".contributors img, .right-rail").first().waitFor({ state: "visible", timeout: 45_000 });
  }

  async observeContributors(fixture: ProviderFixture): Promise<ContributorsObservationData> {
    const contributors = this.page.locator(".contributors img");
    const contributorCount = await contributors.count();
    return {
      nameWithOwner: fixture.nameWithOwner,
      contributorCount,
      firstContributorLogin: contributorCount > 0 ? await contributors.first().getAttribute("alt") : null,
      unavailableVisible: false
    };
  }

  async openSecurityQuality(): Promise<void> {
    await this.page.locator(".repo-tabs").getByRole("button", { name: /^Security and Quality/ }).click();
    await this.page
      .locator(".security-quality-panel, .github-split .empty-state, .github-split .error-state")
      .first()
      .waitFor({ state: "visible", timeout: 45_000 });
  }

  async observeSecurityQuality(fixture: ProviderFixture): Promise<SecurityQualityObservationData> {
    const panel = this.page.locator(".security-quality-panel");
    return {
      nameWithOwner: fixture.nameWithOwner,
      branchProtectionVisible: (await panel.getByRole("heading", { name: "Default branch protection" }).count()) > 0,
      dependabotVisible: (await panel.getByRole("heading", { name: "Dependabot alerts" }).count()) > 0,
      codeScanningVisible: (await panel.getByRole("heading", { name: "Code scanning alerts" }).count()) > 0,
      secretScanningVisible: (await panel.getByRole("heading", { name: "Secret scanning alerts" }).count()) > 0,
      qualityLinkCount: await panel.locator(".tile-grid .project-tile").count(),
      unavailableVisible: (await panel.locator(".error-state").count()) > 0
    };
  }

  async openActions(): Promise<void> {
    await this.page.locator(".repo-tabs").getByRole("button", { name: /^Actions/ }).click();
    await this.page
      .locator(".thread-list .issue-row, .github-split .empty-state")
      .first()
      .waitFor({ state: "visible", timeout: 45_000 });
  }

  async observeActions(fixture: ProviderFixture): Promise<ActionsObservationData> {
    const runs = this.page.locator(".thread-list .issue-row");
    return {
      nameWithOwner: fixture.nameWithOwner,
      runCount: await runs.count(),
      firstRunTitle: await visibleText(runs.first().locator("strong").first())
    };
  }

  async openFirstActionRun(): Promise<void> {
    await this.page.locator(".thread-list .issue-row").first().click();
    await this.page.locator(".workflow-detail-grid").first().waitFor({ state: "visible", timeout: 45_000 });
  }

  async observeActionRun(fixture: ProviderFixture): Promise<ActionRunObservationData> {
    const jobsSection = this.page.locator(".workflow-detail-grid section").filter({
      has: this.page.getByRole("heading", { name: "Jobs" })
    });
    return {
      nameWithOwner: fixture.nameWithOwner,
      title: await visibleText(this.page.locator(".thread-detail .thread-header h2").first()),
      jobCount: await jobsSection.locator(".workflow-job-card").count(),
      logsVisible: (await this.page.getByText("Workflow logs").count()) > 0,
      artifactsVisible: (await this.page.getByRole("heading", { name: "Artifacts" }).count()) > 0
    };
  }

  async screenshot(path: string): Promise<void> {
    await this.page.screenshot({ path, fullPage: true });
  }

  async close(): Promise<string[]> {
    await this.app.close();
    return copyControlDatabaseFiles(this.userDataDir, this.artifactDir);
  }
}

async function visibleText(locator: Locator): Promise<string | null> {
  if ((await locator.count()) === 0) {
    return null;
  }
  return (await locator.first().innerText().catch(() => null))?.trim() ?? null;
}

async function optionLabel(locator: Locator): Promise<string | null> {
  if ((await locator.count()) === 0) {
    return null;
  }
  return (
    (await locator.first().evaluate((option) => option.textContent?.trim().replace(/\s+/g, " ") ?? null)) ??
    null
  );
}

async function countRepoLinks(page: Page, fixture: ProviderFixture): Promise<number> {
  const repoPath = await currentGitHubRepoPath(page, fixture);
  return page.evaluate(({ owner, repo }) => {
    const prefix = `/${owner}/${repo}/`;
    const links = [...document.querySelectorAll<HTMLAnchorElement>("a[href*='/blob/'], a[href*='/tree/']")];
    const unique = new Set(
      links
        .map((link) => new URL(link.href).pathname)
        .filter((pathname) => pathname.startsWith(prefix))
    );
    return unique.size;
  }, repoPath);
}

async function firstGitHubThreadLink(
  page: Page,
  fixture: ProviderFixture,
  kind: "issues" | "pull"
): Promise<{ href: string; number: number; title: string }> {
  const repoPath = await currentGitHubRepoPath(page, fixture);
  const item = await page.evaluate(
    ({ owner, repo, kind }) => {
      const pattern = new RegExp(`/${owner}/${repo}/${kind}/(\\d+)(?:$|[?#])`);
      const anchors = [...document.querySelectorAll<HTMLAnchorElement>(`a[href*='/${kind}/']`)];
      for (const anchor of anchors) {
        const match = anchor.href.match(pattern);
        const title = anchor.textContent?.trim().replace(/\s+/g, " ");
        if (match && title && !title.startsWith("#")) {
          return {
            href: anchor.href,
            number: Number(match[1]),
            title
          };
        }
      }
      return null;
    },
    { owner: repoPath.owner, repo: repoPath.repo, kind }
  );

  if (!item) {
    throw new Error(`No ${kind} link found for ${fixture.nameWithOwner}.`);
  }
  return item;
}

async function firstGitHubActionRunLink(
  page: Page,
  fixture: ProviderFixture
): Promise<{ href: string; id: string; title: string }> {
  const repoPath = await currentGitHubRepoPath(page, fixture);
  const item = await page.evaluate(
    ({ owner, repo }) => {
      const pattern = new RegExp(`/${owner}/${repo}/actions/runs/(\\d+)(?:$|[?#/])`);
      const anchors = [...document.querySelectorAll<HTMLAnchorElement>("a[href*='/actions/runs/']")];
      for (const anchor of anchors) {
        const match = anchor.href.match(pattern);
        const title = anchor.textContent?.trim().replace(/\s+/g, " ");
        if (match && title) {
          return {
            href: anchor.href,
            id: match[1],
            title
          };
        }
      }
      return null;
    },
    { owner: repoPath.owner, repo: repoPath.repo }
  );

  if (!item) {
    throw new Error(`No Actions run link found for ${fixture.nameWithOwner}.`);
  }
  return item;
}

async function currentGitHubRepoPath(page: Page, fixture: ProviderFixture): Promise<{ owner: string; repo: string }> {
  const parsed = new URL(page.url());
  const [, owner, repo] = parsed.pathname.split("/");
  if (owner && repo) {
    return { owner, repo };
  }
  const alias = fixture.aliases?.[0];
  if (alias) {
    const [aliasOwner, aliasRepo] = alias.split("/");
    return { owner: aliasOwner, repo: aliasRepo };
  }
  return { owner: fixture.owner, repo: fixture.repo };
}

function parseThreadNumber(text: string): number {
  const match = text.match(/#(\d+)/);
  if (!match) {
    throw new Error(`Could not parse thread number from "${text}".`);
  }
  return Number(match[1]);
}

function parseCount(text: string, pattern: RegExp): number {
  const match = text.match(pattern);
  return match ? Number(match[1]) : 0;
}

function copyControlDatabaseFiles(userDataDir: string, artifactDir: string): string[] {
  const sourceDir = join(userDataDir, "Control");
  const copied: string[] = [];
  for (const filename of ["control.sqlite", "control.sqlite-wal", "control.sqlite-shm"]) {
    const source = join(sourceDir, filename);
    if (!existsSync(source)) {
      continue;
    }
    const destination = join(artifactDir, filename);
    copyFileSync(source, destination);
    copied.push(destination);
  }
  return copied;
}

async function clickVirtualFile(page: Page, name: RegExp): Promise<void> {
  const list = page.locator(".virtual-file-list");
  const row = list.getByRole("button", { name }).first();

  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (await row.isVisible().catch(() => false)) {
      await row.click();
      return;
    }

    await list.evaluate((element, attemptIndex) => {
      element.scrollTop = attemptIndex === 0 ? 0 : element.scrollTop + Math.max(element.clientHeight * 0.75, 240);
    }, attempt);
    await page.waitForTimeout(100);
  }

  throw new Error(`Could not find ${name} in the virtual file list.`);
}

function compactEnv(input: NodeJS.ProcessEnv): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      env[key] = value;
    }
  }
  return env;
}

function readGhAuthToken(): string | undefined {
  try {
    const token = execFileSync("gh", ["auth", "token", "--hostname", "github.com"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
    return token || undefined;
  } catch {
    return undefined;
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
