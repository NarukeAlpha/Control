import { expect, test } from "@playwright/test";

test("renders the Control glass GitHub surface", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /apple \/ swift/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Pull requests/i }).first()).toBeVisible();
  await expect(page.getByText("The Swift Programming Language").first()).toBeVisible();
  await expect(page.getByText("README.md").first()).toBeVisible();
  await expect(page.locator(".right-rail")).toBeVisible();
  await expect(page.locator(".file-row").first()).toBeVisible();
});
