import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { IssueSummary, PullRequestSummary, RepositoryDetail, WorkflowRunSummary } from "@shared/github";
import type { ControlApi } from "@shared/ipc";
import { AgentsTab, type AgentsTabProps } from "./AgentsTab";

const repository = {
  owner: "apple",
  name: "swift",
  nameWithOwner: "apple/swift",
  htmlUrl: "https://github.com/apple/swift"
} as RepositoryDetail;
const available = { status: "available", message: null };

function makeIssue(overrides: Partial<IssueSummary> = {}): IssueSummary {
  return {
    id: 42,
    nodeId: "issue-node-42",
    number: 42,
    title: "Prepare async agent handoff",
    state: "OPEN",
    stateReason: null,
    authorLogin: "slightbug",
    authorAvatarUrl: null,
    comments: 2,
    labels: [{ id: "agent-label", name: "Agent", color: "4f46e5" }],
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-19T12:00:00.000Z",
    htmlUrl: "https://github.com/apple/swift/issues/42",
    ...overrides
  };
}

function makePullRequest(overrides: Partial<PullRequestSummary> = {}): PullRequestSummary {
  return {
    id: 9,
    nodeId: "pull-node-9",
    number: 9,
    title: "Fix repository workflow cache",
    state: "OPEN",
    merged: false,
    mergedAt: null,
    isDraft: true,
    authorLogin: "swift-ci",
    authorAvatarUrl: null,
    comments: 1,
    reviewComments: 3,
    additions: 12,
    deletions: 4,
    changedFiles: 2,
    mergeableState: "dirty",
    reviewDecision: null,
    mergeCommitSha: null,
    maintainerCanModify: true,
    isCrossRepository: false,
    headRefName: "fix-cache",
    baseRefName: "main",
    createdAt: "2026-05-02T00:00:00.000Z",
    updatedAt: "2026-05-19T10:00:00.000Z",
    htmlUrl: "https://github.com/apple/swift/pull/9",
    ...overrides
  };
}

function makeWorkflowRun(overrides: Partial<WorkflowRunSummary> = {}): WorkflowRunSummary {
  return {
    id: 9001,
    name: "CI",
    displayTitle: "Failing CI",
    runNumber: 20,
    runAttempt: 1,
    event: "pull_request",
    status: "completed",
    conclusion: "failure",
    branch: "fix-cache",
    commitSha: "abc123",
    headRepositoryNameWithOwner: "apple/swift",
    actorLogin: "swift-ci",
    actorAvatarUrl: null,
    triggeringActorLogin: "swift-ci",
    runStartedAt: "2026-05-19T09:00:00.000Z",
    createdAt: "2026-05-19T09:00:00.000Z",
    updatedAt: "2026-05-19T09:05:00.000Z",
    htmlUrl: "https://github.com/apple/swift/actions/runs/9001",
    ...overrides
  };
}

function installControlApi() {
  const api = {
    github: {
      listIssuesWithStatus: vi.fn().mockResolvedValue({
        items: [makeIssue(), makeIssue({ id: 43, number: 43, labels: [] })],
        availability: available
      }),
      listPullRequestsWithStatus: vi.fn().mockResolvedValue({
        items: [makePullRequest(), makePullRequest({ id: 10, number: 10, state: "CLOSED" })],
        availability: available
      }),
      listActionsWithStatus: vi.fn().mockResolvedValue({
        items: [
          makeWorkflowRun(),
          makeWorkflowRun({ id: 9002, displayTitle: "Passing CI", conclusion: "success" })
        ],
        availability: available
      })
    }
  } as unknown as ControlApi;
  (window as unknown as { control?: ControlApi }).control = api;
  return api;
}

function renderAgents(overrides: Partial<AgentsTabProps> = {}): AgentsTabProps {
  const props: AgentsTabProps = {
    repository,
    githubReady: true,
    issueListLimit: 100,
    pullRequestListLimit: 100,
    actionsLimit: 100,
    onOpenExternal: vi.fn(),
    onOpenFilteredSurface: vi.fn(),
    onSelectIssue: vi.fn(),
    onSelectPullRequest: vi.fn(),
    onSelectWorkflowRun: vi.fn(),
    ...overrides
  };

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });

  render(
    <QueryClientProvider client={queryClient}>
      <AgentsTab {...props} />
    </QueryClientProvider>
  );

  return props;
}

afterEach(() => {
  delete (window as unknown as { control?: ControlApi }).control;
});

describe("AgentsTab", () => {
  it("routes agent issue controls through Control and GitHub URLs", async () => {
    installControlApi();
    const props = renderAgents();

    expect(screen.getByRole("heading", { name: "Agents" })).toBeInTheDocument();
    expect(await screen.findByText("#42 Prepare async agent handoff")).toBeInTheDocument();

    const issueTile = screen.getByText("Agent issues").closest("article");
    expect(issueTile).not.toBeNull();

    const issueSurface = within(issueTile as HTMLElement);
    expect(issueSurface.getByText("1 open")).toBeInTheDocument();
    expect(issueSurface.getByText("#42 Prepare async agent handoff")).toBeInTheDocument();

    fireEvent.click(issueSurface.getByRole("button", { name: "Open issue #42 in Control" }));
    fireEvent.click(issueSurface.getByRole("button", { name: "Open in Control" }));
    fireEvent.click(issueSurface.getByRole("button", { name: "Open on GitHub" }));

    expect(props.onSelectIssue).toHaveBeenCalledWith(expect.objectContaining({ id: 42, number: 42 }));
    expect(props.onOpenFilteredSurface).toHaveBeenCalledWith("issues", "label:agent");
    expect(props.onOpenExternal).toHaveBeenCalledWith(
      "https://github.com/apple/swift/issues?q=is%3Aissue%20is%3Aopen%20label%3Aagent"
    );
  });

  it("previews only attention workflow runs and open pull requests", async () => {
    installControlApi();
    const props = renderAgents();

    expect(await screen.findByText("Failing CI")).toBeInTheDocument();
    const actionsTile = screen.getByText("Automation runs").closest("article");
    expect(actionsTile).not.toBeNull();
    const actionsSurface = within(actionsTile as HTMLElement);
    expect(actionsSurface.getByText("1 attention")).toBeInTheDocument();
    expect(actionsSurface.getByText("Failing CI")).toBeInTheDocument();
    expect(actionsSurface.queryByText("Passing CI")).not.toBeInTheDocument();

    fireEvent.click(actionsSurface.getByRole("button", { name: "Open workflow run Failing CI in Control" }));
    expect(props.onSelectWorkflowRun).toHaveBeenCalledWith(expect.objectContaining({ id: 9001 }));

    const pullTile = screen.getByText("Pull request queue").closest("article");
    expect(pullTile).not.toBeNull();
    const pullSurface = within(pullTile as HTMLElement);
    expect(pullSurface.getByText("1 open")).toBeInTheDocument();
    expect(pullSurface.getByText("#9 Fix repository workflow cache")).toBeInTheDocument();
    expect(pullSurface.queryByText("#10 Fix repository workflow cache")).not.toBeInTheDocument();

    fireEvent.click(pullSurface.getByRole("button", { name: "Open pull request #9 in Control" }));
    expect(props.onSelectPullRequest).toHaveBeenCalledWith(expect.objectContaining({ id: 9, number: 9 }));
  });

  it("keeps unavailable data section-local", async () => {
    const api = installControlApi();
    vi.mocked(api.github.listActionsWithStatus).mockResolvedValue({
      items: [],
      availability: { status: "permission_denied", message: "Actions scope unavailable." }
    });
    renderAgents();

    const actionsTile = await screen.findByText("Automation runs");
    const actionsSurface = within(actionsTile.closest("article") as HTMLElement);

    expect(await actionsSurface.findByText("unavailable")).toBeInTheDocument();
    expect(
      actionsSurface.getByText(/Automation runs unavailable: The current GitHub token cannot access/)
    ).toBeInTheDocument();
    expect(await screen.findByText("#42 Prepare async agent handoff")).toBeInTheDocument();
    expect(await screen.findByText("#9 Fix repository workflow cache")).toBeInTheDocument();
  });
});
