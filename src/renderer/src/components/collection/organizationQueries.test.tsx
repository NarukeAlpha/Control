import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { GitHubReadAvailability, OrganizationListResult } from "@shared/github";
import type { ControlApi } from "@shared/ipc";

import { mockControlApi } from "../../data/mock";
import { useOrganizationsRouteQueries } from "./organizationQueries";

const available: GitHubReadAvailability = { status: "available", message: null };

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });
}

function makeApi(githubOverrides: Partial<ControlApi["github"]>): ControlApi {
  return {
    ...mockControlApi,
    github: {
      ...mockControlApi.github,
      ...githubOverrides
    }
  };
}

function OrganizationsRouteQueryProbe() {
  useOrganizationsRouteQueries({
    enabled: true,
    githubReady: false,
    organizationListLimit: 50,
    selectedOrganizationLogin: "openai",
    organizationRepositoryLimits: { openai: 60 },
    organizationTeamLimits: { openai: 30 },
    organizationMemberLimits: { openai: 40 },
    organizationProjectLimits: { openai: 20 },
    selectedOrganizationTeamSlug: "core",
    organizationTeamRepositoryLimits: { "openai/core": 10 },
    organizationTeamMemberLimits: { "openai/core": 12 }
  });

  return null;
}

afterEach(() => {
  cleanup();
  delete (window as unknown as { control?: ControlApi }).control;
  vi.restoreAllMocks();
});

describe("useOrganizationsRouteQueries", () => {
  it("starts dependent organization and team queries from selected string keys before parent lists load", async () => {
    const queryClient = makeQueryClient();
    let organizationsResolved = false;
    let resolveOrganizations!: (result: OrganizationListResult) => void;
    const organizationsPromise = new Promise<OrganizationListResult>((resolve) => {
      resolveOrganizations = (result) => {
        organizationsResolved = true;
        resolve(result);
      };
    });
    const listOrganizationsWithStatus = vi.fn<ControlApi["github"]["listOrganizationsWithStatus"]>(
      () => organizationsPromise
    );
    const listOrganizationTeamsWithStatus = vi.fn<ControlApi["github"]["listOrganizationTeamsWithStatus"]>(
      mockControlApi.github.listOrganizationTeamsWithStatus
    );
    const listOrganizationRepositoriesWithStatus = vi.fn<
      ControlApi["github"]["listOrganizationRepositoriesWithStatus"]
    >(mockControlApi.github.listOrganizationRepositoriesWithStatus);
    const listOrganizationMembersWithStatus = vi.fn<
      ControlApi["github"]["listOrganizationMembersWithStatus"]
    >(mockControlApi.github.listOrganizationMembersWithStatus);
    const listOrganizationProjectsWithStatus = vi.fn<
      ControlApi["github"]["listOrganizationProjectsWithStatus"]
    >(mockControlApi.github.listOrganizationProjectsWithStatus);
    const listOrganizationTeamRepositoriesWithStatus = vi.fn<
      ControlApi["github"]["listOrganizationTeamRepositoriesWithStatus"]
    >(mockControlApi.github.listOrganizationTeamRepositoriesWithStatus);
    const listOrganizationTeamMembersWithStatus = vi.fn<
      ControlApi["github"]["listOrganizationTeamMembersWithStatus"]
    >(mockControlApi.github.listOrganizationTeamMembersWithStatus);
    const api = makeApi({
      listOrganizationsWithStatus,
      listOrganizationTeamsWithStatus,
      listOrganizationRepositoriesWithStatus,
      listOrganizationMembersWithStatus,
      listOrganizationProjectsWithStatus,
      listOrganizationTeamRepositoriesWithStatus,
      listOrganizationTeamMembersWithStatus
    });
    (window as unknown as { control?: ControlApi }).control = api;

    render(
      <QueryClientProvider client={queryClient}>
        <OrganizationsRouteQueryProbe />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(listOrganizationTeamsWithStatus).toHaveBeenCalledWith({
        org: "openai",
        limit: 30,
        cacheOnly: true
      });
      expect(listOrganizationRepositoriesWithStatus).toHaveBeenCalledWith({
        org: "openai",
        limit: 60,
        cacheOnly: true
      });
      expect(listOrganizationMembersWithStatus).toHaveBeenCalledWith({
        org: "openai",
        limit: 40,
        cacheOnly: true
      });
      expect(listOrganizationProjectsWithStatus).toHaveBeenCalledWith({
        org: "openai",
        limit: 20,
        cacheOnly: true
      });
      expect(listOrganizationTeamRepositoriesWithStatus).toHaveBeenCalledWith({
        org: "openai",
        teamSlug: "core",
        limit: 10,
        cacheOnly: true
      });
      expect(listOrganizationTeamMembersWithStatus).toHaveBeenCalledWith({
        org: "openai",
        teamSlug: "core",
        limit: 12,
        cacheOnly: true
      });
    });

    expect(organizationsResolved).toBe(false);
    expect(listOrganizationsWithStatus).toHaveBeenCalledWith({
      limit: 50,
      cacheOnly: true
    });

    resolveOrganizations({ items: [], availability: available });
  });
});
