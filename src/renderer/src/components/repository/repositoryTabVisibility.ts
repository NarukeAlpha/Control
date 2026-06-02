import type { RepositoryDetail, RepositoryTabPreference, RepositoryTabPreferenceKey } from "@shared/github";

import type { AppRoute, RepositoryTab } from "../../stores/uiStore";
import { repoTabs, type RepositoryTabDescriptor } from "./repositoryTabs";

export type { RepositoryTabPreferenceKey } from "@shared/github";

export interface RepositoryTabVisibilityInput {
  repository: RepositoryDetail | null;
  activeRoute: Extract<AppRoute, { kind: "repository" }> | null;
  preferences: Partial<Record<RepositoryTabPreferenceKey, RepositoryTabPreference>>;
}

export interface RepositoryTabVisibilityResult {
  tabs: RepositoryTabDescriptor[];
  hiddenReasons: Partial<Record<RepositoryTabPreferenceKey, string>>;
  routeOnlyTab: RepositoryTabDescriptor | null;
  queryGates: Record<RepositoryTab, boolean>;
}

const requiredRepositoryTabs = ["code", "issues", "pulls", "actions"] as const satisfies RepositoryTab[];

export const repositoryTabPreferenceKeys = [
  "agents",
  "discussions",
  "projects",
  "releases",
  "contributors",
  "wiki",
  "securityQuality",
  "settings"
] as const satisfies RepositoryTabPreferenceKey[];

export const repositoryTabPreferenceLabels: Record<RepositoryTabPreferenceKey, string> = {
  agents: "Agents",
  discussions: "Discussions",
  projects: "Projects",
  releases: "Releases",
  contributors: "Contributors",
  wiki: "Wiki",
  securityQuality: "Security and Quality",
  settings: "Settings"
};

const repositoryTabPreferenceKeySet = new Set<RepositoryTabPreferenceKey>(repositoryTabPreferenceKeys);

const tabDescriptors = new Map<RepositoryTab, RepositoryTabDescriptor>(
  repoTabs.map((descriptor) => [descriptor.key, descriptor])
);

export function visibleRepositoryTabs(input: RepositoryTabVisibilityInput): RepositoryTabVisibilityResult {
  const visibleTabs = new Set<RepositoryTab>(requiredRepositoryTabs);
  const hiddenReasons: Partial<Record<RepositoryTabPreferenceKey, string>> = {};

  for (const key of repositoryTabPreferenceKeys) {
    const preference = input.preferences[key] ?? "auto";
    if (preference === "show") {
      visibleTabs.add(key);
      continue;
    }

    if (preference === "hide") {
      hiddenReasons[key] = "Hidden by preference.";
      continue;
    }

    const autoVisibility = autoRepositoryTabVisibility(key, input.repository);
    if (autoVisibility.visible) {
      visibleTabs.add(key);
    } else {
      hiddenReasons[key] = autoVisibility.reason;
    }
  }

  const tabs = repoTabs.filter((descriptor) => visibleTabs.has(descriptor.key));
  const activeRouteTab = input.activeRoute?.tab ?? null;
  const routeOnlyTab =
    activeRouteTab && isRepositoryTabPreferenceKey(activeRouteTab) && !visibleTabs.has(activeRouteTab)
      ? routeOnlyDescriptor(activeRouteTab, hiddenReasons[activeRouteTab])
      : null;

  return {
    tabs,
    hiddenReasons,
    routeOnlyTab,
    queryGates: queryGatesFor(visibleTabs)
  };
}

export function repositoryTabQueryEnabled(
  tab: RepositoryTab,
  route: Extract<AppRoute, { kind: "repository" }> | null,
  visibility: RepositoryTabVisibilityResult
): boolean {
  return route?.tab === tab && visibility.queryGates[tab];
}

export function isRepositoryTabPreferenceKey(tab: RepositoryTab): tab is RepositoryTabPreferenceKey {
  return repositoryTabPreferenceKeySet.has(tab as RepositoryTabPreferenceKey);
}

function autoRepositoryTabVisibility(
  tab: RepositoryTabPreferenceKey,
  repository: RepositoryDetail | null
): { visible: boolean; reason: string } {
  if (!repository) {
    return { visible: false, reason: "Repository details are still loading." };
  }

  switch (tab) {
    case "agents":
      return { visible: false, reason: "Agents are hidden in Auto until a repository signal is available." };
    case "contributors":
      return {
        visible: false,
        reason:
          "Contributors are hidden in Auto because repository details do not include a contributor count."
      };
    case "discussions":
      return featureOrCountVisibility(
        "Discussions",
        repository.administration.features.discussions,
        repository.counts.discussions
      );
    case "projects":
      // GitHub's repository project signals may describe classic Projects, not Projects V2.
      // Use Show as the escape hatch until the provider exposes a reliable Projects V2 count.
      return featureOrCountVisibility(
        "Projects",
        repository.administration.features.projects,
        repository.counts.projects
      );
    case "wiki":
      return repository.administration.features.wiki === true
        ? { visible: true, reason: "" }
        : {
            visible: false,
            reason: "Wiki is hidden in Auto because repository metadata does not show it enabled."
          };
    case "releases":
      return repository.counts.releases > 0
        ? { visible: true, reason: "" }
        : { visible: false, reason: "Releases are hidden in Auto because this repository has no releases." };
    case "securityQuality":
      return securityQualityVisibility(repository);
    case "settings":
      return repository.viewerState.canAdminister ||
        repository.administration.viewerPermissions.admin === true
        ? { visible: true, reason: "" }
        : {
            visible: false,
            reason: "Settings is hidden in Auto because the viewer cannot administer this repository."
          };
  }
}

function featureOrCountVisibility(
  label: string,
  featureEnabled: boolean | null,
  count: number
): { visible: boolean; reason: string } {
  if (featureEnabled === true || count > 0) {
    return { visible: true, reason: "" };
  }

  return {
    visible: false,
    reason: `${label} is hidden in Auto because repository metadata does not show it enabled or populated.`
  };
}

function securityQualityVisibility(repository: RepositoryDetail): { visible: boolean; reason: string } {
  const availabilityStatus = repository.administrationAvailability?.status ?? null;
  if (availabilityStatus !== "available" && availabilityStatus !== "stale") {
    return {
      visible: false,
      reason: "Security and Quality is hidden in Auto because administration metadata is unavailable."
    };
  }

  const securityAndAnalysis = Object.values(repository.administration.securityAndAnalysis);
  const hasEnabledSecuritySurface = securityAndAnalysis.some((status) => status === "enabled");
  const canAdminister = repository.viewerState.canAdminister;
  const hasAdminPermission = repository.administration.viewerPermissions.admin === true;
  const hasMaintainPermission = repository.administration.viewerPermissions.maintain === true;

  if (hasEnabledSecuritySurface || canAdminister || hasAdminPermission || hasMaintainPermission) {
    return { visible: true, reason: "" };
  }

  return {
    visible: false,
    reason:
      "Security and Quality is hidden in Auto because no enabled security surface or admin permission is known."
  };
}

function queryGatesFor(visibleTabs: Set<RepositoryTab>): Record<RepositoryTab, boolean> {
  return {
    code: visibleTabs.has("code"),
    issues: visibleTabs.has("issues"),
    pulls: visibleTabs.has("pulls"),
    discussions: visibleTabs.has("discussions"),
    projects: visibleTabs.has("projects"),
    releases: visibleTabs.has("releases"),
    contributors: visibleTabs.has("contributors"),
    agents: visibleTabs.has("agents"),
    actions: visibleTabs.has("actions"),
    wiki: visibleTabs.has("wiki"),
    securityQuality: visibleTabs.has("securityQuality"),
    settings: visibleTabs.has("settings")
  };
}

function routeOnlyDescriptor(
  tab: RepositoryTabPreferenceKey,
  hiddenReason: string | undefined
): RepositoryTabDescriptor {
  const descriptor = tabDescriptors.get(tab);
  if (!descriptor) {
    throw new Error(`Missing repository tab descriptor for ${tab}.`);
  }

  return {
    ...descriptor,
    routeOnly: true,
    hiddenReason
  };
}
