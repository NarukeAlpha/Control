import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { GitHubReadAvailability } from "@shared/github";
import type { ControlApi } from "@shared/ipc";
import { mockControlApi } from "../../../data/mock";
import { mockPullRequests } from "../../../data/mocks/pulls";
import { mockRepository } from "../../../data/mocks/repository";
import { PullRequestsTab } from "./PullRequestsTab";

const available = { status: "available", message: null } satisfies GitHubReadAvailability;
const focusedPull = mockPullRequests[0];

function installControlApi() {
  const listPullRequestsWithStatus = vi.fn<ControlApi["github"]["listPullRequestsWithStatus"]>(async () => ({
    items: [focusedPull],
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
      listPullRequestLinkedIssuesWithStatus
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
    listPullRequestLinkedIssuesWithStatus
  };
}

function renderPullRequestsTab(): void {
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
        repository={mockRepository}
        githubReady={true}
        selectedRef={null}
        refListLimit={20}
        pullRequestListLimit={20}
        pullState="open"
        focusedPullNumber={focusedPull.number}
        initialFilter=""
        initialCreating={false}
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
        onMutate={vi.fn()}
      />
    </QueryClientProvider>
  );
}

afterEach(() => {
  cleanup();
  delete window.control;
});

describe("PullRequestsTab", () => {
  it("loads only overview on selection and fetches files after the files section is requested", async () => {
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

    expect(api.listPullRequestCommentsWithStatus).not.toHaveBeenCalled();
    expect(api.listPullRequestFilesWithStatus).not.toHaveBeenCalled();
    expect(api.listPullRequestCommitsWithStatus).not.toHaveBeenCalled();
    expect(api.listPullRequestReviewsWithStatus).not.toHaveBeenCalled();
    expect(api.listPullRequestChecksWithStatus).not.toHaveBeenCalled();
    expect(api.listPullRequestReviewThreadsWithStatus).not.toHaveBeenCalled();
    expect(api.listPullRequestTimelineWithStatus).not.toHaveBeenCalled();
    expect(api.listPullRequestLinkedIssuesWithStatus).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Load changed files" }));

    await waitFor(() => expect(api.listPullRequestFilesWithStatus).toHaveBeenCalledTimes(1));
    expect(api.listPullRequestCommentsWithStatus).not.toHaveBeenCalled();
    expect(api.listPullRequestCommitsWithStatus).not.toHaveBeenCalled();
    expect(api.listPullRequestReviewsWithStatus).not.toHaveBeenCalled();
    expect(api.listPullRequestChecksWithStatus).not.toHaveBeenCalled();
    expect(api.listPullRequestReviewThreadsWithStatus).not.toHaveBeenCalled();
    expect(api.listPullRequestTimelineWithStatus).not.toHaveBeenCalled();
    expect(api.listPullRequestLinkedIssuesWithStatus).not.toHaveBeenCalled();
  });
});
