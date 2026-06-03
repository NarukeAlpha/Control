import { describe, expect, it } from "vitest";

import type { RepositoryDetail } from "@shared/github";

import { mockRepository } from "../../data/mocks/repository";
import type { AppRoute, RepositoryTab } from "../../stores/uiStore";
import { repositoryTabQueryEnabled, visibleRepositoryTabs } from "./repositoryTabVisibility";

const repositoryRoute = (tab: RepositoryTab): Extract<AppRoute, { kind: "repository" }> => ({
  kind: "repository",
  nameWithOwner: "apple/swift",
  tab
});

const tabKeys = (repository: RepositoryDetail | null, preferences = {}) =>
  visibleRepositoryTabs({ repository, activeRoute: null, preferences }).tabs.map((tab) => tab.key);

function makeRepository(): RepositoryDetail {
  return structuredClone(mockRepository);
}

function minimalAutoRepository(): RepositoryDetail {
  const repository = makeRepository();
  repository.counts = {
    ...repository.counts,
    discussions: 0,
    projects: 0,
    releases: 0
  };
  repository.viewerState = {
    ...repository.viewerState,
    canAdminister: false,
    permission: "READ"
  };
  repository.administrationAvailability = { status: "available", message: null };
  repository.administration = {
    ...repository.administration,
    features: {
      ...repository.administration.features,
      projects: false,
      wiki: false,
      discussions: false
    },
    viewerPermissions: {
      admin: false,
      maintain: false,
      push: false,
      triage: false,
      pull: true
    },
    securityAndAnalysis: Object.fromEntries(
      Object.keys(repository.administration.securityAndAnalysis).map((key) => [key, "disabled"])
    ) as RepositoryDetail["administration"]["securityAndAnalysis"]
  };
  return repository;
}

describe("visibleRepositoryTabs", () => {
  it("applies Auto rules without persisting required tabs", () => {
    const repository = minimalAutoRepository();
    repository.administration.features.discussions = true;
    repository.administration.features.wiki = true;
    repository.counts.releases = 2;

    const visibility = visibleRepositoryTabs({ repository, activeRoute: null, preferences: {} });

    expect(visibility.tabs.map((tab) => tab.key)).toEqual([
      "code",
      "issues",
      "pulls",
      "actions",
      "discussions",
      "releases",
      "wiki",
      "settings"
    ]);
    expect(visibility.queryGates.code).toBe(true);
    expect(visibility.queryGates.projects).toBe(false);
    expect(visibility.hiddenReasons.projects).toContain("Projects");
  });

  it("honors Show preferences even when Auto would hide a tab", () => {
    expect(tabKeys(minimalAutoRepository(), { contributors: "show", projects: "show" })).toEqual([
      "code",
      "issues",
      "pulls",
      "actions",
      "projects",
      "contributors",
      "settings"
    ]);
  });

  it("honors Hide preferences even when repository metadata would show a tab", () => {
    const repository = makeRepository();
    repository.administrationAvailability = { status: "available", message: null };

    const visibility = visibleRepositoryTabs({
      repository,
      activeRoute: null,
      preferences: { discussions: "hide", wiki: "hide" }
    });

    expect(visibility.tabs.map((tab) => tab.key)).not.toContain("discussions");
    expect(visibility.tabs.map((tab) => tab.key)).not.toContain("wiki");
    expect(visibility.hiddenReasons.discussions).toBe("Hidden by preference.");
    expect(visibility.queryGates.wiki).toBe(false);
  });

  it("returns a route-only descriptor when the active route targets a hidden preference tab", () => {
    const route = repositoryRoute("wiki");
    const visibility = visibleRepositoryTabs({
      repository: makeRepository(),
      activeRoute: route,
      preferences: { wiki: "hide" }
    });

    expect(visibility.tabs.map((tab) => tab.key)).not.toContain("wiki");
    expect(visibility.routeOnlyTab).toMatchObject({
      key: "wiki",
      label: "Wiki",
      routeOnly: true,
      hiddenReason: "Hidden by preference."
    });
    expect(repositoryTabQueryEnabled("wiki", route, visibility)).toBe(false);
  });

  it("uses only admin and maintain predicates for Security and Quality auto visibility", () => {
    const repository = minimalAutoRepository();
    repository.administration.viewerPermissions = {
      admin: false,
      maintain: true,
      push: true,
      triage: true,
      pull: true
    };

    const visibility = visibleRepositoryTabs({ repository, activeRoute: null, preferences: {} });
    expect(visibility.tabs.map((tab) => tab.key)).toContain("securityQuality");
    expect(visibility.tabs.map((tab) => tab.key)).toContain("settings");

    repository.administration.viewerPermissions.maintain = false;
    const readOnlyVisibility = visibleRepositoryTabs({ repository, activeRoute: null, preferences: {} });
    expect(readOnlyVisibility.tabs.map((tab) => tab.key)).not.toContain("securityQuality");
    expect(readOnlyVisibility.tabs.map((tab) => tab.key)).toContain("settings");

    repository.viewerState.canAdminister = true;
    const adminVisibility = visibleRepositoryTabs({ repository, activeRoute: null, preferences: {} });
    expect(adminVisibility.tabs.map((tab) => tab.key)).toEqual(
      expect.arrayContaining(["securityQuality", "settings"])
    );
  });

  it("hides Agents in Auto because repository detail has no source signal", () => {
    const visibility = visibleRepositoryTabs({
      repository: makeRepository(),
      activeRoute: null,
      preferences: {}
    });

    expect(visibility.tabs.map((tab) => tab.key)).not.toContain("agents");
    expect(visibility.hiddenReasons.agents).toContain("repository signal");
    expect(visibility.queryGates.agents).toBe(false);
  });

  it("keeps null repository layout deterministic while honoring forced preferences", () => {
    const visibility = visibleRepositoryTabs({
      repository: null,
      activeRoute: repositoryRoute("discussions"),
      preferences: { releases: "show", wiki: "hide" }
    });

    expect(visibility.tabs.map((tab) => tab.key)).toEqual([
      "code",
      "issues",
      "pulls",
      "actions",
      "releases",
      "settings"
    ]);
    expect(visibility.hiddenReasons.discussions).toBe("Repository details are still loading.");
    expect(visibility.hiddenReasons.wiki).toBe("Hidden by preference.");
    expect(visibility.routeOnlyTab).toMatchObject({ key: "discussions", routeOnly: true });
  });
});
