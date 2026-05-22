import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  ContributorSummary,
  GitHubReadAvailability,
  RepositoryDetail,
  RepositorySummary
} from "@shared/github";
import type { ControlApi } from "@shared/ipc";
import { mockRepository } from "../../../data/mocks/repository";
import {
  clearContributorsTabStateForTests,
  ContributorsTab,
  ContributorsTabBoundary,
  prefetchContributorsTabData,
  type ContributorsTabProps
} from "./ContributorsTab";

const available = { status: "available", message: null } satisfies GitHubReadAvailability;

const repository: RepositoryDetail = {
  ...mockRepository,
  id: "repo-1",
  owner: "NarukeAlpha",
  name: "control",
  nameWithOwner: "NarukeAlpha/control",
  htmlUrl: "https://github.com/NarukeAlpha/control",
  defaultBranch: "main"
};

function makeContributor(overrides: Partial<ContributorSummary> = {}): ContributorSummary {
  return {
    id: 101,
    login: "octocat",
    avatarUrl: null,
    htmlUrl: "https://github.com/octocat",
    contributions: 42,
    ...overrides
  };
}

function makeRepository(overrides: Partial<RepositorySummary> = {}): RepositorySummary {
  return {
    id: 2,
    owner: "octocat",
    name: "hello-world",
    nameWithOwner: "octocat/hello-world",
    description: "Example repository",
    htmlUrl: "https://github.com/octocat/hello-world",
    defaultBranch: "main",
    visibility: "PUBLIC",
    isPrivate: false,
    isFork: false,
    primaryLanguage: { name: "TypeScript", color: "#3178c6", size: 1, percent: 100 },
    pushedAt: "2026-05-18T00:00:00.000Z",
    updatedAt: "2026-05-19T00:00:00.000Z",
    counts: { stars: 12, forks: 3, watchers: 2, openIssues: 1 },
    viewerPermission: null,
    ...overrides
  } as RepositorySummary;
}

function installControlApi() {
  const api = {
    github: {
      getAccountProfileWithStatus: vi.fn().mockResolvedValue({
        profile: {
          login: "octocat",
          name: "The Octocat",
          avatarUrl: null,
          htmlUrl: "https://github.com/octocat",
          bio: "GitHub mascot",
          company: null,
          location: null,
          websiteUrl: null,
          repositoryCount: 10,
          starredRepositoryCount: 5,
          followers: 99
        },
        availability: available
      }),
      listAccountRepositoriesWithStatus: vi.fn().mockResolvedValue({
        items: [makeRepository()],
        availability: available
      })
    }
  } as unknown as ControlApi;
  (window as unknown as { control?: ControlApi }).control = api;
  return api;
}

function renderContributors(overrides: Partial<ContributorsTabProps> = {}): ContributorsTabProps {
  const props: ContributorsTabProps = {
    repository,
    githubReady: true,
    contributors: [makeContributor(), makeContributor({ id: 102, login: "hubot", contributions: 7 })],
    contributorLimit: 24,
    availability: available,
    focusedContributorLogin: null,
    loading: false,
    error: null,
    onOpenRepository: vi.fn(),
    onOpenExternal: vi.fn(),
    onSelectContributor: vi.fn(),
    onExpandContributors: vi.fn(),
    ...overrides
  };
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });

  render(
    <QueryClientProvider client={queryClient}>
      <ContributorsTab {...props} />
    </QueryClientProvider>
  );

  return props;
}

afterEach(() => {
  delete (window as unknown as { control?: ControlApi }).control;
  clearContributorsTabStateForTests();
});

describe("ContributorsTab", () => {
  it("loads the selected contributor profile and repositories through the tab module", async () => {
    const api = installControlApi();
    const props = renderContributors();

    expect(await screen.findByText("The Octocat")).toBeInTheDocument();
    expect(await screen.findByText("octocat/hello-world")).toBeInTheDocument();

    expect(api.github.getAccountProfileWithStatus).toHaveBeenCalledWith({
      login: "octocat",
      cacheOnly: false
    });
    expect(api.github.listAccountRepositoriesWithStatus).toHaveBeenCalledWith({
      login: "octocat",
      limit: 12,
      cacheOnly: false
    });

    fireEvent.click(screen.getByText("octocat/hello-world").closest("button")!);
    expect(props.onOpenRepository).toHaveBeenCalledWith("octocat/hello-world");
  });

  it("filters contributors and keeps offline profile reads cache-only", async () => {
    const api = installControlApi();
    const props = renderContributors({ githubReady: false });

    fireEvent.change(screen.getByLabelText("Filter contributors"), { target: { value: "hubot" } });
    expect(screen.queryByText("@octocat")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTitle("View @hubot in Control"));

    await waitFor(() => {
      expect(api.github.getAccountProfileWithStatus).toHaveBeenLastCalledWith({
        login: "hubot",
        cacheOnly: true
      });
    });
    expect(props.onSelectContributor).toHaveBeenCalledWith(props.contributors[1]);
  });

  it("retains tab-local filter state across unmounts for the same repository focus", () => {
    installControlApi();
    const props = renderContributors();

    fireEvent.change(screen.getByLabelText("Filter contributors"), { target: { value: "hubot" } });
    expect(screen.queryByText("@octocat")).not.toBeInTheDocument();

    cleanup();
    renderContributors(props);

    expect(screen.getByLabelText("Filter contributors")).toHaveValue("hubot");
    expect(screen.queryByText("@octocat")).not.toBeInTheDocument();
  });

  it("contains render failures inside the contributors tab boundary", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    function BrokenTab(): null {
      throw new Error("Contributor panel crashed");
    }

    render(
      <ContributorsTabBoundary resetKey="NarukeAlpha/control:default">
        <BrokenTab />
      </ContributorsTabBoundary>
    );

    expect(screen.getByText("Contributors unavailable: Contributor panel crashed")).toBeInTheDocument();
    consoleError.mockRestore();
  });

  it("exports a pure prefetch function for shell-owned warm loading", async () => {
    const api = installControlApi();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });
    const contributors = [makeContributor(), makeContributor({ id: 102, login: "hubot", contributions: 7 })];

    await prefetchContributorsTabData(queryClient, {
      api,
      githubReady: false,
      contributors,
      focusedContributorLogin: "hubot",
      profileRepositoryLimit: 20
    });

    expect(api.github.getAccountProfileWithStatus).toHaveBeenCalledWith({
      login: "hubot",
      cacheOnly: true
    });
    expect(api.github.listAccountRepositoriesWithStatus).toHaveBeenCalledWith({
      login: "hubot",
      limit: 20,
      cacheOnly: true
    });
  });
});
