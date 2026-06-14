import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { GitHubReadAvailability, PullRequestSummary, RepositoryDetail } from "@shared/github";
import type { ControlApi } from "@shared/ipc";
import { mockControlApi } from "../../../data/mock";
import { mockPullRequests } from "../../../data/mocks/pulls";
import { mockRepository } from "../../../data/mocks/repository";
import { PullRequestsTab, type PullRequestsTabProps } from "./PullRequestsTab";

const available = { status: "available", message: null } satisfies GitHubReadAvailability;
const focusedPull = mockPullRequests[0];

function installControlApi(pulls: PullRequestSummary[] = [focusedPull]) {
  const listPullRequestsWithStatus = vi.fn<ControlApi["github"]["listPullRequestsWithStatus"]>(async () => ({
    items: pulls,
    availability: available
  }));
  const getPullRequestOverviewWithStatus = vi.fn<ControlApi["github"]["getPullRequestOverviewWithStatus"]>(
    mockControlApi.github.getPullRequestOverviewWithStatus
  );
  const listPullRequestCommentsWithStatus = vi.fn<ControlApi["github"]["listPullRequestCommentsWithStatus"]>(
    mockControlApi.github.listPullRequestCommentsWithStatus
  );
  const listPullRequestFilesWithStatus = vi.fn<ControlApi["github"]["listPullRequestFilesWithStatus"]>(
    mockControlApi.github.listPullRequestFilesWithStatus
  );
  const listPullRequestCommitsWithStatus = vi.fn<ControlApi["github"]["listPullRequestCommitsWithStatus"]>(
    mockControlApi.github.listPullRequestCommitsWithStatus
  );
  const listPullRequestReviewsWithStatus = vi.fn<ControlApi["github"]["listPullRequestReviewsWithStatus"]>(
    mockControlApi.github.listPullRequestReviewsWithStatus
  );
  const listPullRequestChecksWithStatus = vi.fn<ControlApi["github"]["listPullRequestChecksWithStatus"]>(
    mockControlApi.github.listPullRequestChecksWithStatus
  );
  const listPullRequestReviewThreadsWithStatus = vi.fn<
    ControlApi["github"]["listPullRequestReviewThreadsWithStatus"]
  >(mockControlApi.github.listPullRequestReviewThreadsWithStatus);
  const listPullRequestTimelineWithStatus = vi.fn<ControlApi["github"]["listPullRequestTimelineWithStatus"]>(
    mockControlApi.github.listPullRequestTimelineWithStatus
  );
  const listPullRequestLinkedIssuesWithStatus = vi.fn<
    ControlApi["github"]["listPullRequestLinkedIssuesWithStatus"]
  >(mockControlApi.github.listPullRequestLinkedIssuesWithStatus);
  const getBranchProtection = vi.fn<ControlApi["github"]["getBranchProtection"]>(
    mockControlApi.github.getBranchProtection
  );
  const api = {
    ...mockControlApi,
    github: {
      ...mockControlApi.github,
      listPullRequestsWithStatus,
      getPullRequestOverviewWithStatus,
      listPullRequestCommentsWithStatus,
      listPullRequestFilesWithStatus,
      listPullRequestCommitsWithStatus,
      listPullRequestReviewsWithStatus,
      listPullRequestChecksWithStatus,
      listPullRequestReviewThreadsWithStatus,
      listPullRequestTimelineWithStatus,
      listPullRequestLinkedIssuesWithStatus,
      getBranchProtection
    }
  } satisfies ControlApi;
  window.control = api;
  return {
    api,
    listPullRequestsWithStatus,
    getPullRequestOverviewWithStatus,
    listPullRequestCommentsWithStatus,
    listPullRequestFilesWithStatus,
    listPullRequestCommitsWithStatus,
    listPullRequestReviewsWithStatus,
    listPullRequestChecksWithStatus,
    listPullRequestReviewThreadsWithStatus,
    listPullRequestTimelineWithStatus,
    listPullRequestLinkedIssuesWithStatus,
    getBranchProtection
  };
}

function renderPullRequestsTab({
  pull = focusedPull,
  repository = mockRepository,
  initialCreating = false,
  onMutate = vi.fn<PullRequestsTabProps["onMutate"]>()
}: {
  pull?: PullRequestSummary;
  repository?: RepositoryDetail;
  initialCreating?: boolean;
  onMutate?: PullRequestsTabProps["onMutate"];
} = {}): { onMutate: PullRequestsTabProps["onMutate"] } {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });

  render(
    <QueryClientProvider client={queryClient}>
      <PullRequestsTab
        repository={repository}
        githubReady={true}
        selectedRef={null}
        refListLimit={20}
        pullRequestListLimit={20}
        pullState="open"
        focusedPullNumber={pull.number}
        initialFilter=""
        initialCreating={initialCreating}
        mutationAction={null}
        mutationPending={false}
        mutationSucceeded={false}
        mutationError={null}
        onOpenExternal={vi.fn()}
        onOpenPullRequestDetail={vi.fn()}
        onOpenPullRequestList={vi.fn()}
        onPullStateChange={vi.fn()}
        onOpenIssueReference={vi.fn()}
        onOpenPullRequestCommit={vi.fn()}
        onOpenPullRequestReviewCommit={vi.fn()}
        onOpenPullRequestTimelineEventCommit={vi.fn()}
        onOpenWorkflowRun={vi.fn()}
        onOpenCodePath={vi.fn()}
        onExpandPullRequests={vi.fn()}
        onMutate={onMutate}
      />
    </QueryClientProvider>
  );
  return { onMutate };
}

afterEach(() => {
  cleanup();
  delete window.control;
});

describe("PullRequestsTab", () => {
  it("loads routed timeline sections and fetches files after the files tab is selected", async () => {
    const api = installControlApi();
    renderPullRequestsTab();

    await screen.findByRole("heading", { name: focusedPull.title });
    expect(api.listPullRequestsWithStatus).toHaveBeenCalledWith({
      owner: mockRepository.owner,
      repo: mockRepository.name,
      state: "open",
      limit: 20,
      cacheOnly: false
    });
    await waitFor(() => expect(api.getPullRequestOverviewWithStatus).toHaveBeenCalledTimes(1));

    await waitFor(() => expect(api.listPullRequestCommentsWithStatus).toHaveBeenCalledTimes(1));
    expect(api.listPullRequestCommitsWithStatus).toHaveBeenCalledTimes(1);
    expect(api.listPullRequestReviewsWithStatus).toHaveBeenCalledTimes(1);
    expect(api.listPullRequestTimelineWithStatus).toHaveBeenCalledTimes(1);
    expect(api.listPullRequestFilesWithStatus).not.toHaveBeenCalled();
    expect(api.listPullRequestChecksWithStatus).not.toHaveBeenCalled();
    expect(api.listPullRequestReviewThreadsWithStatus).not.toHaveBeenCalled();
    expect(api.listPullRequestLinkedIssuesWithStatus).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("tab", { name: /Files changed/ }));

    await waitFor(() => expect(api.listPullRequestFilesWithStatus).toHaveBeenCalledTimes(1));
    expect(api.listPullRequestCommentsWithStatus).toHaveBeenCalledTimes(1);
    expect(api.listPullRequestCommitsWithStatus).toHaveBeenCalledTimes(1);
    expect(api.listPullRequestReviewsWithStatus).toHaveBeenCalledTimes(1);
    expect(api.listPullRequestChecksWithStatus).not.toHaveBeenCalled();
    expect(api.listPullRequestReviewThreadsWithStatus).toHaveBeenCalledTimes(1);
    expect(api.listPullRequestTimelineWithStatus).toHaveBeenCalledTimes(1);
    expect(api.listPullRequestLinkedIssuesWithStatus).not.toHaveBeenCalled();
  });

  it("uses the prefetched allowed merge method when merge commits are blocked", async () => {
    const mergeablePull = mockPullRequests[2];
    const api = installControlApi([mergeablePull]);
    const { onMutate } = renderPullRequestsTab({ pull: mergeablePull });

    await screen.findByRole("heading", { name: mergeablePull.title });
    await waitFor(() => expect(api.getPullRequestOverviewWithStatus).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(api.getBranchProtection).toHaveBeenCalledTimes(1));

    expect(screen.queryByRole("button", { name: "Create merge commit" })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Squash merge" }));

    expect(onMutate).toHaveBeenCalledWith("mergePullRequest", true, {
      pullNumber: mergeablePull.number,
      merge_method: "squash"
    });
  });

  it("blocks pull request creation when administration metadata marks the repository archived", async () => {
    installControlApi();
    const archivedRepository = {
      ...mockRepository,
      permissions: {
        ...mockRepository.permissions,
        isArchived: false
      },
      administration: {
        ...mockRepository.administration,
        isArchived: true
      }
    };
    const { onMutate } = renderPullRequestsTab({
      repository: archivedRepository,
      initialCreating: true
    });

    expect(
      await screen.findByText("Pull request creation unavailable: Repository is archived.")
    ).toBeInTheDocument();
    const createButton = screen.getByRole("button", { name: /Create pull request/i });
    expect(createButton).toBeDisabled();
    fireEvent.click(createButton);
    expect(onMutate).not.toHaveBeenCalled();
  });
});
