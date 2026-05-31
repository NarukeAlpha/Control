import type { LocalRecentItem, LocalRecentRecordInput } from "@shared/local";
import type { AppRoute, LocalRepositoryTab, RepositoryTab } from "../../stores/uiStore";
import { recentItemRecordInput, recentMetadataNumber, recentMetadataString } from "./recentRecordInputs";
import { repoTabs } from "../repository/repositoryTabs";

interface OpenRecentItemHandlers {
  navigate(route: AppRoute): void;
  goToOrganizations(): void;
  goToLocalRepository(
    areaId: string,
    repositoryId: string,
    tab?: LocalRepositoryTab,
    workspaceId?: string | null,
    path?: string | null
  ): void;
  openCodeBrowser(
    nameWithOwner: string,
    path: string,
    entryType: "file" | "dir",
    ref?: string | null,
    line?: number | null
  ): void;
  openCodeBrowserInApp(
    nameWithOwner: string,
    path: string,
    entryType: "file" | "dir",
    ref: string | null,
    line?: number | null
  ): void;
  recordRecent(input: LocalRecentRecordInput): void;
  resetRepositoryRefForDefaultOpen(nameWithOwner: string): void;
  setSelectedOrganizationLogin(login: string | null): void;
  setSelectedOrganizationTeamSlug(slug: string | null): void;
  setSelectedOrganizationMemberLogin(login: string | null): void;
  setSelectedOrganizationProjectId(projectId: string | null): void;
  openExternal(url: string): void;
}

function recordOpenedRecent(item: LocalRecentItem, handlers: OpenRecentItemHandlers): void {
  handlers.recordRecent(recentItemRecordInput(item));
}

export function openRecentItemInApp(item: LocalRecentItem, handlers: OpenRecentItemHandlers): void {
  if (item.kind === "organization") {
    const organizationLogin = recentMetadataString(item, "login") ?? item.itemKey;
    if (organizationLogin) {
      handlers.setSelectedOrganizationLogin(organizationLogin);
      handlers.setSelectedOrganizationTeamSlug(null);
      handlers.setSelectedOrganizationMemberLogin(null);
      handlers.setSelectedOrganizationProjectId(null);
      handlers.goToOrganizations();
      recordOpenedRecent(item, handlers);
      return;
    }
  }

  if (item.kind === "team") {
    const [itemKeyOrganizationLogin, itemKeyTeamSlug] = item.itemKey.split("/");
    const organizationLogin = recentMetadataString(item, "organizationLogin") ?? itemKeyOrganizationLogin;
    const teamSlug = recentMetadataString(item, "slug") ?? itemKeyTeamSlug;
    if (organizationLogin && teamSlug) {
      handlers.setSelectedOrganizationLogin(organizationLogin);
      handlers.setSelectedOrganizationTeamSlug(teamSlug);
      handlers.setSelectedOrganizationMemberLogin(null);
      handlers.setSelectedOrganizationProjectId(null);
      handlers.goToOrganizations();
      recordOpenedRecent(item, handlers);
      return;
    }
  }

  if (item.kind === "repository" && item.provider === "local" && item.areaId && item.repositoryId) {
    handlers.goToLocalRepository(item.areaId, item.repositoryId, "overview", item.workspaceId ?? null);
    recordOpenedRecent(item, handlers);
    return;
  }

  if (item.kind === "repository" && item.repositoryNameWithOwner) {
    const tab = recentMetadataString(item, "tab");
    const repositoryTab = repoTabs.some((candidate) => candidate.key === tab)
      ? (tab as RepositoryTab)
      : undefined;
    const ref = recentMetadataString(item, "ref");
    if ((repositoryTab ?? "code") === "code" && ref) {
      handlers.openCodeBrowserInApp(item.repositoryNameWithOwner, "", "dir", ref);
      recordOpenedRecent(item, handlers);
      return;
    }
    handlers.resetRepositoryRefForDefaultOpen(item.repositoryNameWithOwner);
    handlers.navigate({
      kind: "repository",
      nameWithOwner: item.repositoryNameWithOwner,
      tab: repositoryTab ?? "code"
    });
    recordOpenedRecent(item, handlers);
    return;
  }

  if (item.kind === "contributor" && item.repositoryNameWithOwner) {
    const contributorLogin = recentMetadataString(item, "login");
    if (contributorLogin) {
      handlers.navigate({
        kind: "repository",
        nameWithOwner: item.repositoryNameWithOwner,
        tab: "contributors",
        contributorLogin
      });
      recordOpenedRecent(item, handlers);
      return;
    }
  }

  if (item.kind === "file" && item.provider === "local" && item.areaId && item.repositoryId) {
    const path = recentMetadataString(item, "path");
    handlers.goToLocalRepository(
      item.areaId,
      item.repositoryId,
      "code",
      item.workspaceId ?? null,
      path ?? "."
    );
    recordOpenedRecent(item, handlers);
    return;
  }

  if (item.kind === "file" && item.repositoryNameWithOwner) {
    const path = recentMetadataString(item, "path");
    if (path) {
      handlers.openCodeBrowserInApp(
        item.repositoryNameWithOwner,
        path,
        "file",
        recentMetadataString(item, "ref"),
        recentMetadataNumber(item, "line")
      );
      return;
    }
  }

  if (item.kind === "commit" && item.repositoryNameWithOwner) {
    const sha = recentMetadataString(item, "sha") ?? item.itemKey.split(":commit:")[1]?.split(":")[0];
    if (sha) {
      const path = recentMetadataString(item, "path") ?? "";
      const entryType = recentMetadataString(item, "entryType") === "file" ? "file" : "dir";
      handlers.openCodeBrowser(
        item.repositoryNameWithOwner,
        path,
        entryType,
        sha,
        recentMetadataNumber(item, "line")
      );
      recordOpenedRecent(item, handlers);
      return;
    }
  }

  if (item.kind === "issue" && item.repositoryNameWithOwner) {
    const issueNumber = recentMetadataNumber(item, "number");
    if (issueNumber !== null) {
      handlers.navigate({
        kind: "repository",
        nameWithOwner: item.repositoryNameWithOwner,
        tab: "issues",
        issueNumber
      });
      recordOpenedRecent(item, handlers);
      return;
    }
  }

  if (item.kind === "pullRequest" && item.repositoryNameWithOwner) {
    const pullNumber = recentMetadataNumber(item, "number");
    if (pullNumber !== null) {
      handlers.navigate({
        kind: "repository",
        nameWithOwner: item.repositoryNameWithOwner,
        tab: "pulls",
        pullNumber
      });
      recordOpenedRecent(item, handlers);
      return;
    }
  }

  if (item.kind === "discussion" && item.repositoryNameWithOwner) {
    const discussionNumber = recentMetadataNumber(item, "number");
    if (discussionNumber !== null) {
      handlers.navigate({
        kind: "repository",
        nameWithOwner: item.repositoryNameWithOwner,
        tab: "discussions",
        discussionNumber
      });
      recordOpenedRecent(item, handlers);
      return;
    }
  }

  if (item.kind === "release" && item.repositoryNameWithOwner) {
    const releaseTagName = recentMetadataString(item, "tagName");
    const releaseId = recentMetadataNumber(item, "releaseId");
    if (releaseTagName || releaseId !== null) {
      handlers.navigate({
        kind: "repository",
        nameWithOwner: item.repositoryNameWithOwner,
        tab: "releases",
        releaseId: releaseId ?? undefined,
        releaseTagName: releaseTagName ?? undefined
      });
      recordOpenedRecent(item, handlers);
      return;
    }
  }

  if (item.kind === "releaseAsset" && item.repositoryNameWithOwner) {
    const releaseTagName = recentMetadataString(item, "tagName");
    const releaseId = recentMetadataNumber(item, "releaseId");
    const releaseAssetId = recentMetadataNumber(item, "assetId");
    if ((releaseTagName || releaseId !== null) && releaseAssetId !== null) {
      handlers.navigate({
        kind: "repository",
        nameWithOwner: item.repositoryNameWithOwner,
        tab: "releases",
        releaseId: releaseId ?? undefined,
        releaseTagName: releaseTagName ?? undefined,
        releaseAssetId
      });
      recordOpenedRecent(item, handlers);
      return;
    }
  }

  if (item.kind === "project" && item.repositoryNameWithOwner) {
    const projectId = recentMetadataString(item, "projectId");
    if (projectId) {
      handlers.navigate({
        kind: "repository",
        nameWithOwner: item.repositoryNameWithOwner,
        tab: "projects",
        projectId
      });
      recordOpenedRecent(item, handlers);
      return;
    }
  }

  if (item.kind === "project") {
    const organizationLogin = recentMetadataString(item, "organizationLogin");
    const projectId = recentMetadataString(item, "projectId");
    if (organizationLogin && projectId) {
      handlers.setSelectedOrganizationLogin(organizationLogin);
      handlers.setSelectedOrganizationTeamSlug(null);
      handlers.setSelectedOrganizationMemberLogin(null);
      handlers.setSelectedOrganizationProjectId(projectId);
      handlers.goToOrganizations();
      recordOpenedRecent(item, handlers);
      return;
    }
  }

  if (item.kind === "workflowRun" && item.repositoryNameWithOwner) {
    const workflowRunId = recentMetadataNumber(item, "runId");
    if (workflowRunId !== null) {
      handlers.navigate({
        kind: "repository",
        nameWithOwner: item.repositoryNameWithOwner,
        tab: "actions",
        workflowRunId
      });
      recordOpenedRecent(item, handlers);
      return;
    }
  }

  if (item.kind === "workflowArtifact" && item.repositoryNameWithOwner) {
    const workflowRunId = recentMetadataNumber(item, "runId");
    const workflowArtifactId = recentMetadataNumber(item, "artifactId");
    if (workflowRunId !== null && workflowArtifactId !== null) {
      handlers.navigate({
        kind: "repository",
        nameWithOwner: item.repositoryNameWithOwner,
        tab: "actions",
        workflowRunId,
        workflowArtifactId
      });
      recordOpenedRecent(item, handlers);
      return;
    }
  }

  if (item.kind === "securityItem" && item.repositoryNameWithOwner) {
    const securityItemKind = recentMetadataString(item, "securityItemKind");
    const securityItemId = recentMetadataString(item, "securityItemId");
    if (
      securityItemId &&
      (securityItemKind === "dependabot" ||
        securityItemKind === "codeScanning" ||
        securityItemKind === "secretScanning" ||
        securityItemKind === "ruleset" ||
        securityItemKind === "advisory")
    ) {
      handlers.navigate({
        kind: "repository",
        nameWithOwner: item.repositoryNameWithOwner,
        tab: "securityQuality",
        securityItemKind,
        securityItemId
      });
      recordOpenedRecent(item, handlers);
      return;
    }
  }

  if (item.kind === "wikiPage" && item.repositoryNameWithOwner) {
    const wikiPagePath = recentMetadataString(item, "path");
    if (wikiPagePath) {
      handlers.navigate({
        kind: "repository",
        nameWithOwner: item.repositoryNameWithOwner,
        tab: "wiki",
        wikiPagePath
      });
      recordOpenedRecent(item, handlers);
      return;
    }
  }

  if (item.url) {
    handlers.openExternal(item.url);
  }
}
