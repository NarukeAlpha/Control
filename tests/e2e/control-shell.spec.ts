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

test("exposes current titlebar controls without overlapping the shell", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator(".topbar")).toBeVisible();
  await expect(page.getByLabel("Search or jump to")).toBeVisible();
  await expect(page.locator(".topbar").getByRole("button", { name: /GitHub/i })).toBeVisible();
  await expect(page.locator(".topbar").getByTitle("Create")).toBeVisible();
  await expect(page.locator(".topbar").getByTitle("Issues")).toBeVisible();
  await expect(page.locator(".topbar").getByTitle("Pull requests")).toBeVisible();
  await expect(page.locator(".topbar").getByTitle("Mailbox")).toBeVisible();
  await expect(page.locator(".topbar").getByTitle("Account settings")).toBeVisible();
});

test("navigates global Issues and Pull Requests from the app shell", async ({ page }) => {
  await page.goto("/");

  await page
    .locator(".nav-list")
    .getByRole("button", { name: /^Issues/ })
    .click();
  await expect(page.getByRole("heading", { name: "Issues" })).toBeVisible();
  await expect(page.locator(".collection-view .issue-row").first()).toBeVisible();

  await page
    .locator(".nav-list")
    .getByRole("button", { name: /^Pull requests/ })
    .click();
  await expect(page.getByRole("heading", { name: "Pull requests" })).toBeVisible();
  await expect(page.locator(".collection-view .issue-row").first()).toBeVisible();
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

  await page
    .locator(".repo-tabs")
    .getByRole("button", { name: /^Pull requests/ })
    .click();
  await expect(page.locator(".table-panel .issue-row").first()).toBeVisible();

  await page
    .locator(".repo-tabs")
    .getByRole("button", { name: /^Actions/ })
    .click();
  await expect(page.locator(".table-panel .issue-row").first()).toBeVisible();
});

test("repository page renders a language panel", async ({ page }) => {
  await page.goto("/");
  await page
    .locator(".topbar")
    .getByTitle(/Open apple\/swift/)
    .click();
  await expect(page.getByRole("heading", { name: "Languages" })).toBeVisible();
});
