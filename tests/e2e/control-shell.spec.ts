import { expect, test } from "@playwright/test";

test("renders the Control glass GitHub surface", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Ashley Rico/i })).toBeVisible();
  await page
    .locator(".topbar")
    .getByTitle(/Open apple\/swift/)
    .click();
  await expect(page.getByRole("heading", { name: /apple \/ swift/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Pull requests/i }).first()).toBeVisible();
  await expect(page.getByText("The Swift Programming Language").first()).toBeVisible();
  await expect(page.getByText("README.md").first()).toBeVisible();
  await expect(page.locator(".right-rail")).toBeVisible();
  await expect(page.locator(".file-row").first()).toBeVisible();
});

test("opens repository files in the code browser", async ({ page }) => {
  await page.goto("/");
  await page
    .locator(".topbar")
    .getByTitle(/Open apple\/swift/)
    .click();

  await page.locator(".virtual-file-list").getByRole("button", { name: /README\.md/i }).click();
  await expect(page.getByRole("heading", { name: "README.md" })).toBeVisible();
  await expect(page.locator(".code-viewer")).toContainText("Mock file content from Control.");
  await expect(page.getByRole("button", { name: "Repository", exact: true })).toBeVisible();
});

test("exposes current titlebar controls without overlapping the shell", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator(".topbar")).toBeVisible();
  await expect(page.getByLabel("Search or jump to")).toBeVisible();
  await expect(page.locator(".topbar").getByRole("button", { name: /GitHub/i })).toBeVisible();
  await expect(page.locator(".topbar").getByTitle("Create")).toBeVisible();
  await expect(page.locator(".topbar").getByTitle("Notifications")).toBeVisible();
  await expect(page.locator(".topbar").getByTitle("Account settings")).toBeVisible();
});

test("navigates app shell surfaces from the sidebar", async ({ page }) => {
  await page.goto("/");

  await page
    .locator(".nav-list")
    .getByRole("button", { name: /^Repositories/ })
    .click();
  await expect(page.getByRole("heading", { name: "Repositories" })).toBeVisible();
  await expect(page.locator(".collection-view .issue-row").first()).toBeVisible();

  await page
    .locator(".nav-list")
    .getByRole("button", { name: /^Mailbox/ })
    .click();
  await expect(page.getByRole("heading", { name: "Mailbox" })).toBeVisible();
  await expect(page.locator(".collection-view .issue-row").first()).toBeVisible();
});

test("opens repositories from sidebar, home activity, and repositories list", async ({ page }) => {
  await page.goto("/");

  await page.locator(".repo-section .repo-item").first().click();
  await expect(page.getByRole("heading", { name: /apple \/ swift/i })).toBeVisible();

  await page.getByRole("button", { name: /^Home$/ }).click();
  await expect(page.getByRole("heading", { name: "Latest repository activity" })).toBeVisible();
  await page
    .locator(".home-panel")
    .filter({ has: page.getByRole("heading", { name: "Latest repository activity" }) })
    .getByRole("button", { name: /apple\/swift/i })
    .click();
  await expect(page.getByRole("heading", { name: /apple \/ swift/i })).toBeVisible();

  await page.getByRole("button", { name: /^Repositories$/ }).click();
  await expect(page.getByRole("heading", { name: "Repositories" })).toBeVisible();
  await page.locator(".collection-view .repository-row").first().click();
  await expect(page.getByRole("heading", { name: /apple \/ swift/i })).toBeVisible();
});

test("navigates repository tabs from the repository route", async ({ page }) => {
  await page.goto("/");
  await page
    .locator(".topbar")
    .getByTitle(/Open apple\/swift/)
    .click();

  await page
    .locator(".repo-tabs")
    .getByRole("button", { name: /^Issues/ })
    .click();
  await expect(page.locator(".table-panel .issue-row").first()).toBeVisible();
  await expect(page.locator(".timeline-thread").first()).toContainText("This issue reproduces");

  await page
    .locator(".repo-tabs")
    .getByRole("button", { name: /^Pull requests/ })
    .click();
  await expect(page.locator(".table-panel .issue-row").first()).toBeVisible();
  await expect(page.locator(".timeline-thread").first()).toContainText("This pull request updates");

  await page
    .locator(".repo-tabs")
    .getByRole("button", { name: /^Actions/ })
    .click();
  await expect(page.locator(".table-panel .issue-row").first()).toBeVisible();

  await page
    .locator(".repo-tabs")
    .getByRole("button", { name: /^Agents/ })
    .click();
  await expect(page.getByRole("button", { name: /Agent issues/i })).toBeVisible();

  await page
    .locator(".repo-tabs")
    .getByRole("button", { name: /^Wiki/ })
    .click();
  await expect(page.getByRole("button", { name: /Repository wiki/i })).toBeVisible();

  await page
    .locator(".repo-tabs")
    .getByRole("button", { name: /^Security and Quality/ })
    .click();
  await expect(page.getByRole("button", { name: /Code scanning/i })).toBeVisible();
});

test("repository page renders a language panel", async ({ page }) => {
  await page.goto("/");
  await page
    .locator(".topbar")
    .getByTitle(/Open apple\/swift/)
    .click();
  await expect(page.getByRole("heading", { name: "Languages" })).toBeVisible();
});
