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

  await page
    .locator(".nav-list")
    .getByRole("button", { name: /^Organizations/ })
    .click();
  await expect(page.getByRole("heading", { name: "Organizations" })).toBeVisible();

  const appleOrg = page.locator(".organization-row").filter({ hasText: "Apple" });
  await expect(appleOrg).toContainText("188 repositories");
  await expect(appleOrg).toContainText("14 teams");
  await expect(appleOrg).toContainText("member");
  await expect(appleOrg).toContainText("Open source projects from Apple.");
  await expect(page.locator(".collection-section-label")).toContainText("apple teams");
  await expect(page.locator(".organization-team-row").first()).toContainText("Compiler");
  await expect(page.locator(".organization-team-row").first()).toContainText("18 members");
  await expect(page.locator(".organization-team-row").filter({ hasText: "Developer Tools" })).toContainText(
    "Parent team: Compiler"
  );

  await page.locator(".organization-row").filter({ hasText: "Swift" }).getByRole("button").first().click();
  await expect(page.locator(".collection-section-label")).toContainText("swiftlang teams");
  await expect(page.getByText("No visible teams returned for this organization.")).toBeVisible();
});

test("manages mailbox notifications in-app", async ({ page }) => {
  await page.goto("/");

  await page
    .locator(".nav-list")
    .getByRole("button", { name: /^Mailbox/ })
    .click();
  await page.getByRole("button", { name: "All" }).click();

  const notification = page
    .locator(".notification-row")
    .filter({ hasText: "Improve Sendable diagnostics for global actors" });
  await expect(notification).toBeVisible();
  await expect(notification.locator(".state-chip")).toHaveText("unread");

  await page
    .getByRole("button", { name: /Mark Improve Sendable diagnostics for global actors as read/i })
    .click();
  await expect(notification.locator(".state-chip")).toHaveText("read");

  await page
    .getByRole("button", { name: /Unsubscribe from Improve Sendable diagnostics for global actors/i })
    .click();
  await expect(notification).toHaveCount(0);
});

test("opens notification subjects in-app and records them as recents", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.removeItem("control:mock:recent-items");
  });
  await page.goto("/");

  await page
    .locator(".nav-list")
    .getByRole("button", { name: /^Mailbox/ })
    .click();
  await page.getByRole("button", { name: "All" }).click();

  await page
    .locator(".notification-row")
    .filter({ hasText: "Improve Sendable diagnostics for global actors" })
    .locator(".notification-row-main")
    .click();
  await expect(
    page.locator(".thread-detail").getByRole("heading", {
      name: /Improve Sendable diagnostics for global actors/i
    })
  ).toBeVisible();

  await page
    .locator(".nav-list")
    .getByRole("button", { name: /^Mailbox/ })
    .click();
  await page.getByRole("button", { name: "All" }).click();
  await page
    .locator(".notification-row")
    .filter({ hasText: "Add Sendable support for @MainActor types" })
    .locator(".notification-row-main")
    .click();
  await expect(
    page.locator(".thread-detail").getByRole("heading", {
      name: /Add Sendable support for @MainActor types/i
    })
  ).toBeVisible();

  await page.getByRole("button", { name: /^Home$/ }).click();
  const recentsPanel = page.locator(".home-panel").filter({ has: page.getByRole("heading", { name: "Recents" }) });
  await expect(recentsPanel.getByRole("button", { name: /#1200 Improve Sendable diagnostics/i })).toBeVisible();
  await expect(recentsPanel.getByRole("button", { name: /#520 Add Sendable support/i })).toBeVisible();
});

test("opens account work rows in-app from Home and Mailbox", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.removeItem("control:mock:recent-items");
    window.localStorage.setItem("control:mock:notifications", "[]");
  });
  await page.goto("/");

  const homeWorkPanel = page
    .locator(".home-panel")
    .filter({ has: page.getByRole("heading", { name: "Your work" }) });
  await homeWorkPanel.getByRole("button", { name: /Improve Sendable diagnostics/i }).first().click();
  await expect(
    page.locator(".thread-detail").getByRole("heading", {
      name: /Improve Sendable diagnostics/i
    })
  ).toBeVisible();

  await page.getByRole("button", { name: /^Home$/ }).click();
  await homeWorkPanel.getByRole("button", { name: /Add Sendable support/i }).first().click();
  await expect(
    page.locator(".thread-detail").getByRole("heading", {
      name: /Add Sendable support/i
    })
  ).toBeVisible();

  await page
    .locator(".nav-list")
    .getByRole("button", { name: /^Mailbox/ })
    .click();
  await page
    .locator(".collection-view .issue-row")
    .filter({ hasText: "Improve Sendable diagnostics" })
    .first()
    .click();
  await expect(
    page.locator(".thread-detail").getByRole("heading", {
      name: /Improve Sendable diagnostics/i
    })
  ).toBeVisible();

  await page.getByRole("button", { name: /^Home$/ }).click();
  const recentsPanel = page.locator(".home-panel").filter({ has: page.getByRole("heading", { name: "Recents" }) });
  await expect(recentsPanel.getByRole("button", { name: /#1197 Improve Sendable diagnostics/i })).toBeVisible();
  await expect(recentsPanel.getByRole("button", { name: /#520 Add Sendable support/i })).toBeVisible();
});

test("opens discussion and release notification subjects in-app", async ({ page }) => {
  await page.addInitScript(() => {
    const updatedAt = new Date().toISOString();
    window.localStorage.setItem(
      "control:mock:notifications",
      JSON.stringify([
        {
          id: "notification-discussion-e2e",
          unread: true,
          reason: "subscribed",
          updatedAt,
          lastReadAt: null,
          participating: true,
          repositoryNameWithOwner: "apple/swift",
          repositoryHtmlUrl: "https://github.com/apple/swift",
          repositoryPrivate: false,
          subject: {
            title: "Package manager ergonomics",
            type: "Discussion",
            apiUrl: null,
            latestCommentApiUrl: null,
            htmlUrl: "https://github.com/apple/swift/discussions/201"
          },
          htmlUrl: "https://github.com/apple/swift/discussions/201"
        },
        {
          id: "notification-release-e2e",
          unread: true,
          reason: "release",
          updatedAt,
          lastReadAt: null,
          participating: null,
          repositoryNameWithOwner: "apple/swift",
          repositoryHtmlUrl: "https://github.com/apple/swift",
          repositoryPrivate: false,
          subject: {
            title: "Swift 5.10.0",
            type: "Release",
            apiUrl: null,
            latestCommentApiUrl: null,
            htmlUrl: "https://github.com/apple/swift/releases/tag/swift-5.10.0"
          },
          htmlUrl: "https://github.com/apple/swift/releases/tag/swift-5.10.0"
        }
      ])
    );
  });
  await page.goto("/");

  await page
    .locator(".nav-list")
    .getByRole("button", { name: /^Mailbox/ })
    .click();
  await page
    .locator(".notification-row")
    .filter({ hasText: "Package manager ergonomics" })
    .locator(".notification-row-main")
    .click();
  await expect(page.locator(".thread-detail").getByRole("heading", { name: "Package manager ergonomics" })).toBeVisible();

  await page
    .locator(".nav-list")
    .getByRole("button", { name: /^Mailbox/ })
    .click();
  await page
    .locator(".notification-row")
    .filter({ hasText: "Swift 5.10.0" })
    .locator(".notification-row-main")
    .click();
  await expect(page.locator(".thread-detail").getByRole("heading", { name: "Swift 5.10.0" })).toBeVisible();
});

test("exposes cache refresh controls across collection and repository surfaces", async ({ page }) => {
  await page.goto("/");

  await page
    .locator(".nav-list")
    .getByRole("button", { name: /^Repositories/ })
    .click();
  const repositoriesRefresh = page.getByRole("button", { name: "Refresh repositories" });
  await expect(repositoriesRefresh).toBeVisible();
  await expect(repositoriesRefresh).toHaveAttribute("title", /Updated|Stale|Not loaded/);
  await repositoriesRefresh.click();
  await expect(page.getByRole("heading", { name: "Repositories" })).toBeVisible();

  await page
    .locator(".nav-list")
    .getByRole("button", { name: /^Organizations/ })
    .click();
  const organizationsRefresh = page.getByRole("button", { name: "Refresh organizations" });
  await expect(organizationsRefresh).toBeVisible();
  await expect(organizationsRefresh).toHaveAttribute("title", /Updated|Stale|Not loaded/);
  await organizationsRefresh.click();
  await expect(page.getByRole("heading", { name: "Organizations" })).toBeVisible();

  await page
    .locator(".topbar")
    .getByTitle(/Open apple\/swift/)
    .click();
  const repositoryRefresh = page.getByRole("button", { name: "Refresh apple/swift" });
  await expect(repositoryRefresh).toBeVisible();
  await expect(repositoryRefresh).toHaveAttribute("title", /Updated|Stale|Not loaded/);
  await repositoryRefresh.click();
  await expect(page.getByRole("heading", { name: /apple \/ swift/i })).toBeVisible();
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

test("searches and adds repositories from in-app pickers", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Search or jump to").fill("open-source");
  const searchPopover = page.locator(".search-popover");
  await searchPopover.getByRole("button", { name: /apple\/open-source/i }).click();
  await expect(page.getByRole("heading", { name: /apple \/ open-source/i })).toBeVisible();

  await page.locator(".repo-section").getByRole("button", { name: "Add repository" }).click();
  const dialog = page.getByRole("dialog", { name: "Add repository" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Repository search").fill("design");
  await dialog.getByRole("button", { name: /apple\/design-resources/i }).click();

  await expect(page.getByRole("heading", { name: /apple \/ design-resources/i })).toBeVisible();

  await page.getByRole("button", { name: /^Home$/ }).click();
  const recentsPanel = page.locator(".home-panel").filter({ has: page.getByRole("heading", { name: "Recents" }) });
  await expect(recentsPanel.getByRole("button", { name: /apple\/design-resources/i })).toBeVisible();
});

test("supports command palette navigation and local repository pinning", async ({ page }) => {
  await page.goto("/");

  await page.keyboard.press("Control+K");
  const palette = page.getByRole("dialog", { name: "Command palette" });
  await expect(palette).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(palette).toHaveCount(0);

  await page.keyboard.press("Control+K");
  await expect(palette).toBeVisible();
  const paletteSearch = palette.getByLabel("Command palette search");
  await paletteSearch.fill("repositories");
  await paletteSearch.press("Enter");

  await expect(page.getByRole("heading", { name: "Repositories" })).toBeVisible();

  await page.locator(".collection-view .repository-row").first().click();
  await expect(page.getByRole("heading", { name: /apple \/ swift/i })).toBeVisible();

  await page.getByRole("button", { name: "Pin" }).click();

  await expect(page.getByRole("button", { name: "Pinned" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /^Home$/ }).click();
  await expect(page.getByRole("heading", { name: "Pinned repositories" })).toBeVisible();
});

test("opens repository create workflows from the command palette", async ({ page }) => {
  await page.goto("/");
  await page
    .locator(".topbar")
    .getByTitle(/Open apple\/swift/)
    .click();

  await page.keyboard.press("Control+K");
  let palette = page.getByRole("dialog", { name: "Command palette" });
  await palette.getByLabel("Command palette search").fill("create issue");
  await palette.getByRole("button", { name: /Create issue in apple\/swift/i }).click();
  await expect(page.getByPlaceholder("Issue title")).toBeVisible();

  await page.keyboard.press("Control+K");
  palette = page.getByRole("dialog", { name: "Command palette" });
  await palette.getByLabel("Command palette search").fill("create pull request");
  await palette.getByRole("button", { name: /Create pull request in apple\/swift/i }).click();
  await expect(page.getByPlaceholder("Pull request title")).toBeVisible();

  await page.keyboard.press("Control+K");
  palette = page.getByRole("dialog", { name: "Command palette" });
  await palette.getByLabel("Command palette search").fill("run workflow");
  await palette.getByRole("button", { name: /Run workflow in apple\/swift/i }).click();
  await expect(page.locator(".thread-detail").getByRole("heading", { name: "Run workflow" })).toBeVisible();
});

test("opens repository utility tabs from the command palette", async ({ page }) => {
  await page.goto("/");
  await page
    .locator(".topbar")
    .getByTitle(/Open apple\/swift/)
    .click();

  await page.keyboard.press("Control+K");
  let palette = page.getByRole("dialog", { name: "Command palette" });
  await palette.getByLabel("Command palette search").fill("actions in");
  await palette.getByRole("button", { name: /Actions in apple\/swift/i }).click();
  await expect(page.locator(".thread-detail").getByRole("heading", { name: "Swift CI" })).toBeVisible();

  await page.keyboard.press("Control+K");
  palette = page.getByRole("dialog", { name: "Command palette" });
  await palette.getByLabel("Command palette search").fill("wiki");
  await palette.getByRole("button", { name: /Wiki in apple\/swift/i }).click();
  await expect(page.getByRole("heading", { name: "Repository wiki" })).toBeVisible();

  await page.keyboard.press("Control+K");
  palette = page.getByRole("dialog", { name: "Command palette" });
  await palette.getByLabel("Command palette search").fill("security quality");
  await palette.getByRole("button", { name: /Security and Quality in apple\/swift/i }).click();
  await expect(page.getByRole("heading", { name: "Default branch protection" })).toBeVisible();

  await page.keyboard.press("Control+K");
  palette = page.getByRole("dialog", { name: "Command palette" });
  await palette.getByLabel("Command palette search").fill("repository settings");
  await palette.getByRole("button", { name: /Repository settings in apple\/swift/i }).click();
  await expect(page.getByRole("heading", { name: "Repository settings" })).toBeVisible();
});

test("tracks issue pull request and workflow recents in the command palette", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.removeItem("control:mock:recent-items");
  });
  await page.goto("/");
  await page
    .locator(".topbar")
    .getByTitle(/Open apple\/swift/)
    .click();

  await page
    .locator(".repo-tabs")
    .getByRole("button", { name: /^Issues/ })
    .click();
  await page.locator(".thread-list .issue-row").filter({ hasText: "#1199" }).click();

  await page
    .locator(".repo-tabs")
    .getByRole("button", { name: /^Pull requests/ })
    .click();
  await page.locator(".thread-list .issue-row").filter({ hasText: "#519" }).click();

  await page
    .locator(".repo-tabs")
    .getByRole("button", { name: /^Actions/ })
    .click();
  await page.locator(".thread-list .issue-row").filter({ hasText: "Docs" }).first().click();

  await page.getByRole("button", { name: /^Home$/ }).click();
  const recentsPanel = page.locator(".home-panel").filter({ has: page.getByRole("heading", { name: "Recents" }) });
  await expect(recentsPanel.getByRole("button", { name: /#1199 Compiler crash in async closure/i })).toBeVisible();
  await expect(recentsPanel.getByRole("button", { name: /#519 Update concurrency runtime tests/i })).toBeVisible();
  await expect(recentsPanel.getByRole("button", { name: /Docs/i })).toBeVisible();

  await page.keyboard.press("Control+K");
  let palette = page.getByRole("dialog", { name: "Command palette" });
  await palette.getByLabel("Command palette search").fill("1199");
  await palette.getByRole("button", { name: /#1199 Compiler crash in async closure/i }).click();
  await expect(page.locator(".thread-detail").getByRole("heading", { name: /Compiler crash in async closure/i })).toBeVisible();

  await page.keyboard.press("Control+K");
  palette = page.getByRole("dialog", { name: "Command palette" });
  await palette.getByLabel("Command palette search").fill("519");
  await palette.getByRole("button", { name: /#519 Update concurrency runtime tests/i }).click();
  await expect(page.locator(".thread-detail").getByRole("heading", { name: /Update concurrency runtime tests/i })).toBeVisible();

  await page.keyboard.press("Control+K");
  palette = page.getByRole("dialog", { name: "Command palette" });
  await palette.getByLabel("Command palette search").fill("docs");
  await palette.getByRole("button", { name: /^Docs/i }).click();
  await expect(page.locator(".thread-detail").getByRole("heading", { name: "Docs" })).toBeVisible();
});

test("opens files through the Go to file finder", async ({ page }) => {
  await page.goto("/");
  await page
    .locator(".topbar")
    .getByTitle(/Open apple\/swift/)
    .click();

  await page.getByLabel("Code reference").selectOption("release/6.0");
  await expect(page.getByLabel("Code reference")).toHaveValue("release/6.0");
  await page.keyboard.press("Control+K");
  const palette = page.getByRole("dialog", { name: "Command palette" });
  await palette.getByLabel("Command palette search").fill("go to file");
  await palette.getByRole("button", { name: /Go to file in apple\/swift/i }).click();
  const finder = page.getByRole("dialog", { name: "Go to file" });
  await expect(finder).toBeVisible();
  await expect(finder.locator(".finder-meta")).toContainText("release/6.0");

  const fileSearch = finder.getByLabel("Go to file search");
  await expect(fileSearch).toHaveAttribute("aria-activedescendant", "file-finder-result-0");
  await expect(finder.getByRole("option", { name: /ci\.yml/i })).toHaveAttribute("aria-selected", "true");
  await fileSearch.press("ArrowDown");
  await expect(finder.getByRole("option", { name: /README\.md/i })).toHaveAttribute("aria-selected", "true");
  await fileSearch.press("Enter");

  await expect(page.getByRole("heading", { name: "README.md" })).toBeVisible();
  await expect(page.locator(".code-viewer-toolbar")).toContainText("release/6.0");
  await expect(page.locator(".code-viewer")).toBeVisible();
});

test("creates edits and deletes releases in-app", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.removeItem("control:mock:releases");
  });
  await page.goto("/");
  await page
    .locator(".topbar")
    .getByTitle(/Open apple\/swift/)
    .click();

  await page
    .locator(".repo-tabs")
    .getByRole("button", { name: /^Releases/ })
    .click();
  const releaseList = page.locator(".github-split .thread-list");
  await expect(page.getByRole("heading", { name: "Swift 5.10.0" })).toBeVisible();

  await page.getByRole("button", { name: "New release" }).click();
  await page.getByPlaceholder("Release tag").fill("swift-e2e");
  await page.getByPlaceholder("Release name").fill("Swift E2E Release");
  await page.getByPlaceholder("Release notes").fill("Release notes from the Playwright smoke.");
  await page.getByRole("button", { name: /Create release/i }).click();

  await expect(releaseList.getByRole("button", { name: /Swift E2E Release/i })).toBeVisible();

  await releaseList.getByRole("button", { name: /Swift E2E Release/i }).click();
  await page.getByRole("button", { name: "Edit release" }).click();
  await page.getByPlaceholder("Release name").fill("Swift E2E Release Edited");
  await page.getByPlaceholder("Release notes").fill("Edited release notes from the Playwright smoke.");
  await page.getByRole("button", { name: /Save release/i }).click();

  await expect(releaseList.getByRole("button", { name: /Swift E2E Release Edited/i })).toBeVisible();

  page.once("dialog", (dialog) => void dialog.accept());
  await releaseList.getByRole("button", { name: /Swift E2E Release Edited/i }).click();
  await page.getByRole("button", { name: "Delete release" }).click();

  await expect(releaseList.getByRole("button", { name: /Swift E2E Release Edited/i })).toHaveCount(0);
});

test("edits issue metadata state and comments in-app", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.removeItem("control:mock:issues");
  });
  await page.goto("/");
  await page
    .locator(".topbar")
    .getByTitle(/Open apple\/swift/)
    .click();

  await page
    .locator(".repo-tabs")
    .getByRole("button", { name: /^Issues/ })
    .click();

  const issueDetail = page.locator(".thread-detail");
  await expect(issueDetail).toContainText("This issue reproduces");

  await page.getByRole("button", { name: "Edit issue" }).click();
  await page.getByPlaceholder("Edit issue title").fill("Updated Sendable diagnostics from E2E");
  await page.getByPlaceholder("Edit issue body").fill("Updated issue body from Playwright.");
  await page.getByRole("button", { name: "Save issue" }).click();

  await expect(issueDetail.getByRole("heading", { name: "Updated Sendable diagnostics from E2E" })).toBeVisible();
  await expect(issueDetail).toContainText("Updated issue body from Playwright.");

  await page.getByRole("button", { name: "Reopen issue" }).click();
  await expect(page.getByRole("button", { name: "Close issue" })).toBeVisible();

  await issueDetail.getByLabel("Available labels").getByRole("button", { name: "bug" }).click();
  await page.getByRole("button", { name: "Add labels" }).click();
  await expect(
    issueDetail.getByLabel("Current labels").getByRole("button", { name: "Remove label bug" })
  ).toBeVisible();
  await issueDetail.getByLabel("Current labels").getByRole("button", { name: "Remove label bug" }).click();
  await expect(
    issueDetail.getByLabel("Current labels").getByRole("button", { name: "Remove label bug" })
  ).toHaveCount(0);

  await issueDetail.getByLabel("Assignable users").getByRole("button", { name: "swift-ci" }).click();
  await page.getByRole("button", { name: "Add assignees" }).click();
  await expect(
    issueDetail.getByLabel("Current assignees").getByRole("button", { name: "Remove assignee swift-ci" })
  ).toBeVisible();
  await issueDetail
    .getByLabel("Current assignees")
    .getByRole("button", { name: "Remove assignee swift-ci" })
    .click();
  await expect(
    issueDetail.getByLabel("Current assignees").getByRole("button", { name: "Remove assignee swift-ci" })
  ).toHaveCount(0);

  await page.getByPlaceholder("Leave a comment").fill("E2E issue comment from Control.");
  await issueDetail.locator(".comment-composer").getByRole("button", { name: "Comment" }).click();
  const createdComment = issueDetail
    .locator(".timeline-comment")
    .filter({ hasText: "E2E issue comment from Control." });
  await expect(createdComment).toBeVisible();

  await createdComment.getByRole("button", { name: "Edit comment" }).click();
  const commentEditor = issueDetail.locator(".timeline-edit-form");
  await commentEditor.getByPlaceholder("Edit comment body").fill("Updated E2E issue comment.");
  await commentEditor.getByRole("button", { name: "Save comment" }).click();
  const updatedComment = issueDetail
    .locator(".timeline-comment")
    .filter({ hasText: "Updated E2E issue comment." });
  await expect(updatedComment).toBeVisible();

  page.once("dialog", (dialog) => void dialog.accept());
  await updatedComment.getByRole("button", { name: "Delete comment" }).click();
  await expect(updatedComment).toHaveCount(0);

  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Close issue" }).click();
  await expect(page.getByRole("button", { name: "Reopen issue" })).toBeVisible();
});

test("manages pull request review state and comments in-app", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.removeItem("control:mock:pull-requests");
  });
  await page.goto("/");
  await page
    .locator(".topbar")
    .getByTitle(/Open apple\/swift/)
    .click();

  await page
    .locator(".repo-tabs")
    .getByRole("button", { name: /^Pull requests/ })
    .click();

  const pullDetail = page.locator(".thread-detail");
  await expect(pullDetail).toContainText("This pull request updates");
  await expect(page.getByRole("button", { name: "Reopen pull request" })).toBeVisible();

  await page.getByRole("button", { name: "Reopen pull request" }).click();
  await expect(page.getByRole("button", { name: "Close pull request" })).toBeVisible();

  const requestedReviewers = pullDetail.getByLabel("Requested reviewers");
  await expect(
    requestedReviewers.getByRole("button", { name: "Remove reviewer swift-ci" })
  ).toBeVisible();
  await expect(
    requestedReviewers.getByRole("button", { name: "Remove team reviewer compiler" })
  ).toBeVisible();

  await pullDetail.getByPlaceholder("GitHub usernames").fill("slightbug");
  await pullDetail.getByPlaceholder("team slugs").fill("developer-tools");
  page.once("dialog", (dialog) => void dialog.accept());
  await pullDetail.getByRole("button", { name: "Request review" }).click();

  await expect(
    requestedReviewers.getByRole("button", { name: "Remove reviewer slightbug" })
  ).toBeVisible();
  await expect(
    requestedReviewers.getByRole("button", { name: "Remove team reviewer developer-tools" })
  ).toBeVisible();

  await requestedReviewers.getByRole("button", { name: "Remove reviewer slightbug" }).click();
  await requestedReviewers.getByRole("button", { name: "Remove team reviewer developer-tools" }).click();
  await expect(
    requestedReviewers.getByRole("button", { name: "Remove reviewer slightbug" })
  ).toHaveCount(0);
  await expect(
    requestedReviewers.getByRole("button", { name: "Remove team reviewer developer-tools" })
  ).toHaveCount(0);

  const pullActions = pullDetail.locator(".thread-actions");
  await pullActions.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(pullDetail.getByText("Approved from Control.")).toBeVisible();

  page.once("dialog", (dialog) => void dialog.accept());
  await pullActions.getByRole("button", { name: "Request changes" }).click();
  await expect(pullDetail.getByText("Changes requested from Control.")).toBeVisible();

  await page.getByPlaceholder("Leave a comment").fill("E2E pull request comment from Control.");
  await pullDetail.locator(".comment-composer").getByRole("button", { name: "Comment" }).click();
  await expect(pullDetail.getByText("E2E pull request comment from Control.")).toBeVisible();

  page.once("dialog", (dialog) => void dialog.accept());
  await pullActions.getByRole("button", { name: "Close pull request" }).click();
  await expect(page.getByRole("button", { name: "Reopen pull request" })).toBeVisible();
});

test("reruns dispatches and cancels workflow runs in-app", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.removeItem("control:mock:workflow-runs");
  });
  await page.goto("/");
  await page
    .locator(".topbar")
    .getByTitle(/Open apple\/swift/)
    .click();

  await page
    .locator(".repo-tabs")
    .getByRole("button", { name: /^Actions/ })
    .click();

  const actionDetail = page.locator(".thread-detail");
  await expect(actionDetail).toContainText("Swift build failed");

  const runActions = actionDetail.locator(".thread-actions");
  page.once("dialog", (dialog) => void dialog.accept());
  await runActions.getByRole("button", { name: "Rerun failed jobs" }).click();
  await expect(actionDetail.locator(".workflow-summary")).toContainText("queued");

  page.once("dialog", (dialog) => void dialog.accept());
  await runActions.getByRole("button", { name: "Cancel run" }).click();
  await expect(actionDetail.locator(".workflow-summary")).toContainText("cancelled");

  await page.locator(".table-action-row").getByRole("button", { name: "Run workflow" }).click();
  const workflowForm = actionDetail.locator("form.compose-form");
  await expect(workflowForm.getByRole("heading", { name: "Run workflow" })).toBeVisible();
  await expect(workflowForm).toContainText("2 dispatch inputs");
  await workflowForm.getByLabel("configuration").selectOption("release");

  page.once("dialog", (dialog) => void dialog.accept());
  await workflowForm.getByRole("button", { name: /Run workflow/ }).click();

  const dispatchedRun = page.locator(".thread-list .issue-row").filter({ hasText: "workflow_dispatch" });
  await expect(dispatchedRun.first()).toContainText("queued");
  await dispatchedRun.first().click();
  await expect(actionDetail).toContainText("workflow_dispatch");
  await expect(actionDetail.locator(".workflow-summary")).toContainText("queued");

  page.once("dialog", (dialog) => void dialog.accept());
  await actionDetail.locator(".thread-actions").getByRole("button", { name: "Cancel run" }).click();
  await expect(actionDetail.locator(".workflow-summary")).toContainText("cancelled");
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
    .getByRole("button", { name: /^Discussions/ })
    .click();
  await expect(page.getByRole("heading", { name: "Swift 6 concurrency migration notes" })).toBeVisible();
  await expect(page.locator(".thread-detail")).toContainText("Read-only in Control");
  await page.getByLabel("Filter discussions").fill("package");
  await expect(page.getByRole("heading", { name: "Package manager ergonomics" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open discussion", exact: true })).toBeVisible();

  await page
    .locator(".repo-tabs")
    .getByRole("button", { name: /^Projects/ })
    .click();
  await expect(page.getByRole("heading", { name: "Compiler quality" })).toBeVisible();
  await expect(page.locator(".thread-detail")).toContainText("Repository project");
  await expect(page.locator(".thread-detail")).toContainText("Read-only summary");
  await expect(page.getByRole("button", { name: "Open project", exact: true })).toBeVisible();

  await page
    .locator(".repo-tabs")
    .getByRole("button", { name: /^Agents/ })
    .click();
  await expect(page.getByRole("button", { name: /Agent issues/i })).toBeVisible();

  await page
    .locator(".repo-tabs")
    .getByRole("button", { name: /^Wiki/ })
    .click();
  await expect(page.getByRole("heading", { name: "Repository wiki" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Open wiki/i })).toBeVisible();

  await page
    .locator(".repo-tabs")
    .getByRole("button", { name: /^Security and Quality/ })
    .click();
  await expect(page.getByRole("heading", { name: "Default branch protection" })).toBeVisible();
  await expect(page.getByLabel("Branch protection")).toContainText("2Required checks");
  await expect(page.getByLabel("Branch protection")).toContainText("macOS build");
  await expect(page.getByLabel("Dependabot alerts")).toContainText("swift-nio");
  await expect(page.getByLabel("Dependabot alerts")).toContainText("Improper input validation");
  await expect(page.getByLabel("Code scanning alerts")).toContainText("swift/path-injection");
  await expect(page.getByLabel("Code scanning alerts")).toContainText("Sources/PackageLoading/ManifestLoader.swift:117");
  await expect(page.getByLabel("Secret scanning alerts")).toContainText("Mailchimp API Key");
  await expect(page.getByLabel("Secret scanning alerts")).toContainText("Secret value hidden by Control.");
  await expect(page.getByRole("button", { name: /Code scanning/i })).toBeVisible();

  await page.getByTitle("Repository settings").click();
  await expect(page.getByRole("heading", { name: "Repository settings" })).toBeVisible();
  await expect(page.locator(".repository-settings-panel")).toContainText("default branch main");
  await expect(page.locator(".repository-settings-panel")).toContainText("Merge policy");
});

test("repository page renders a language panel", async ({ page }) => {
  await page.goto("/");
  await page
    .locator(".topbar")
    .getByTitle(/Open apple\/swift/)
    .click();
  await expect(page.getByRole("heading", { name: "Languages" })).toBeVisible();
});
