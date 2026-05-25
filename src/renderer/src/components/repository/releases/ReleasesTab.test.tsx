import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { GitHubReadAvailability, ReleaseSummary, RepositoryDetail } from "@shared/github";
import type { ControlApi } from "@shared/ipc";
import { mockRepository } from "../../../data/mocks/repository";
import { ReleasesTab } from "./ReleasesTab";

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

function makeRelease(overrides: Partial<ReleaseSummary> = {}): ReleaseSummary {
  return {
    id: 42,
    name: "Direct release",
    tagName: "v42.0.0",
    targetCommitish: "main",
    body: "Direct detail notes",
    isDraft: false,
    isPrerelease: false,
    publishedAt: "2026-05-01T00:00:00.000Z",
    htmlUrl: "https://github.com/NarukeAlpha/control/releases/tag/v42.0.0",
    assets: [],
    ...overrides
  };
}

function installControlApi() {
  const api = {
    github: {
      listReleasesWithStatus: vi.fn().mockResolvedValue({
        items: [],
        availability: available
      }),
      getReleaseDetailWithStatus: vi.fn().mockResolvedValue({
        item: makeRelease(),
        availability: available
      }),
      listBranchesWithStatus: vi.fn().mockResolvedValue({
        items: [],
        availability: available
      }),
      listTagsWithStatus: vi.fn().mockResolvedValue({
        items: [],
        availability: available
      })
    }
  } as unknown as ControlApi;
  (window as unknown as { control?: ControlApi }).control = api;
  return api;
}

function renderReleases(): void {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });

  render(
    <QueryClientProvider client={queryClient}>
      <ReleasesTab
        repository={repository}
        githubReady={true}
        selectedRef={null}
        refListLimit={20}
        releasesLimit={20}
        focusedReleaseId={42}
        focusedReleaseTagName="v42.0.0"
        focusedReleaseAssetId={null}
        initialCreating={false}
        onOpenExternal={vi.fn()}
        onOpenReleaseTarget={vi.fn()}
        onSelectRelease={vi.fn()}
        onSelectReleaseAsset={vi.fn()}
        onExpandReleases={vi.fn()}
        mutationAction={null}
        mutationPending={false}
        mutationSucceeded={false}
        mutationError={null}
        onMutate={vi.fn()}
      />
    </QueryClientProvider>
  );
}

afterEach(() => {
  cleanup();
  delete (window as unknown as { control?: ControlApi }).control;
});

describe("ReleasesTab", () => {
  it("loads focused release detail directly when the release is absent from the list", async () => {
    const api = installControlApi();
    renderReleases();

    expect(await screen.findByRole("heading", { name: "Direct release" })).toBeInTheDocument();
    expect(screen.getByText("Direct detail notes")).toBeInTheDocument();
    expect(api.github.getReleaseDetailWithStatus).toHaveBeenCalledWith({
      owner: "NarukeAlpha",
      repo: "control",
      releaseId: 42,
      releaseTagName: "v42.0.0",
      cacheOnly: false
    });
  });
});
