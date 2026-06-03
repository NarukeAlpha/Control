import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { GitHubReadAvailability, RepositoryDetail } from "@shared/github";
import type { ControlApi } from "@shared/ipc";
import {
  mockDiscussionCategories,
  mockDiscussionDetail,
  mockDiscussions
} from "../../../data/mocks/discussions";
import { mockRepository } from "../../../data/mocks/repository";
import { DiscussionsTab } from "./DiscussionsTab";

const available = { status: "available", message: null } satisfies GitHubReadAvailability;

const repository: RepositoryDetail = {
  ...mockRepository,
  id: "repo-1",
  owner: "NarukeAlpha",
  name: "control",
  nameWithOwner: "NarukeAlpha/control",
  htmlUrl: "https://github.com/NarukeAlpha/control",
  defaultBranch: "main",
  administration: {
    ...mockRepository.administration,
    features: {
      ...mockRepository.administration.features,
      discussions: true
    }
  }
};

function installControlApi() {
  const api = {
    github: {
      listDiscussionsWithStatus: vi.fn().mockResolvedValue({
        items: mockDiscussions,
        availability: available
      }),
      getDiscussionDetail: vi.fn().mockImplementation(mockDiscussionDetail),
      listDiscussionCategoriesWithStatus: vi.fn().mockResolvedValue({
        items: mockDiscussionCategories,
        availability: available
      })
    }
  } as unknown as ControlApi;
  (window as unknown as { control?: ControlApi }).control = api;
  return api;
}

function renderDiscussions(onMutate = vi.fn()): void {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });

  render(
    <QueryClientProvider client={queryClient}>
      <DiscussionsTab
        repository={repository}
        discussionsLimit={20}
        focusedDiscussionNumber={200}
        githubReady={true}
        onOpenExternal={vi.fn()}
        onSelectDiscussion={vi.fn()}
        onExpandDiscussions={vi.fn()}
        mutationAction={null}
        mutationPending={false}
        mutationSucceeded={false}
        mutationError={null}
        onMutate={onMutate}
      />
    </QueryClientProvider>
  );
}

afterEach(() => {
  cleanup();
  delete (window as unknown as { control?: ControlApi }).control;
});

describe("DiscussionsTab", () => {
  it("renders focused discussion detail and submits a new comment", async () => {
    const api = installControlApi();
    const onMutate = vi.fn();
    renderDiscussions(onMutate);

    expect(
      await screen.findByRole("heading", { name: "Swift 6 concurrency migration notes" })
    ).toBeInTheDocument();
    expect(api.github.getDiscussionDetail).toHaveBeenCalledWith({
      owner: "NarukeAlpha",
      repo: "control",
      discussionNumber: 200,
      commentsLimit: 100,
      repliesLimit: 20,
      cacheOnly: false
    });

    fireEvent.change(screen.getByPlaceholderText("Add a discussion comment"), {
      target: { value: "This migration note needs a package example." }
    });
    fireEvent.click(screen.getByRole("button", { name: "Add comment" }));

    expect(onMutate).toHaveBeenCalledWith("addDiscussionComment", false, {
      discussionId: "D_0",
      body: "This migration note needs a package example."
    });
  });
});
