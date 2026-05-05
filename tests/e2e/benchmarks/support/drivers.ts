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
