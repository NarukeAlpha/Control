import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { IssueSummary, PullRequestSummary, RepositoryDetail, WorkflowRunSummary } from "@shared/github";
import { AgentsTab, type AgentsTabProps } from "./AgentsTab";

const repository = {
  htmlUrl: "https://github.com/apple/swift"
} as RepositoryDetail;

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

function renderAgents(overrides: Partial<AgentsTabProps> = {}): AgentsTabProps {
  const props: AgentsTabProps = {
    repository,
    issues: [makeIssue(), makeIssue({ id: 43, number: 43, labels: [] })],
    issuesLoading: false,
    issuesError: null,
    pulls: [makePullRequest(), makePullRequest({ id: 10, number: 10, state: "CLOSED" })],
    pullsLoading: false,
    pullsError: null,
    actions: [
      makeWorkflowRun(),
      makeWorkflowRun({ id: 9002, displayTitle: "Passing CI", conclusion: "success" })
    ],
    actionsLoading: false,
    actionsError: null,
    onOpenExternal: vi.fn(),
    onOpenFilteredSurface: vi.fn(),
    onSelectIssue: vi.fn(),
    onSelectPullRequest: vi.fn(),
    onSelectWorkflowRun: vi.fn(),
    ...overrides
  };

  render(<AgentsTab {...props} />);

  return props;
}

describe("AgentsTab", () => {
  it("routes agent issue controls through Control and GitHub fallback URLs", () => {
    const props = renderAgents();

    expect(screen.getByRole("heading", { name: "Agent workflows open in Control" })).toBeInTheDocument();

    const issueTile = screen.getByText("Agent issues").closest("article");
    expect(issueTile).not.toBeNull();

    const issueSurface = within(issueTile as HTMLElement);
    expect(issueSurface.getByText("1 open")).toBeInTheDocument();
    expect(issueSurface.getByText("#42 Prepare async agent handoff")).toBeInTheDocument();

    fireEvent.click(issueSurface.getByRole("button", { name: "Open issue #42 in Control" }));
    fireEvent.click(issueSurface.getByRole("button", { name: "Open in Control" }));
    fireEvent.click(issueSurface.getByRole("button", { name: "GitHub fallback" }));

    expect(props.onSelectIssue).toHaveBeenCalledWith(props.issues[0]);
    expect(props.onOpenFilteredSurface).toHaveBeenCalledWith("issues", "label:agent");
    expect(props.onOpenExternal).toHaveBeenCalledWith(
      "https://github.com/apple/swift/issues?q=is%3Aissue%20is%3Aopen%20label%3Aagent"
    );
  });

  it("previews only attention workflow runs and open pull requests", () => {
    const props = renderAgents();

    const actionsTile = screen.getByText("Automation runs").closest("article");
    expect(actionsTile).not.toBeNull();
    const actionsSurface = within(actionsTile as HTMLElement);
    expect(actionsSurface.getByText("1 attention")).toBeInTheDocument();
    expect(actionsSurface.getByText("Failing CI")).toBeInTheDocument();
    expect(actionsSurface.queryByText("Passing CI")).not.toBeInTheDocument();

    fireEvent.click(actionsSurface.getByRole("button", { name: "Open workflow run Failing CI in Control" }));
    expect(props.onSelectWorkflowRun).toHaveBeenCalledWith(props.actions[0]);

    const pullTile = screen.getByText("Pull request queue").closest("article");
    expect(pullTile).not.toBeNull();
    const pullSurface = within(pullTile as HTMLElement);
    expect(pullSurface.getByText("1 open")).toBeInTheDocument();
    expect(pullSurface.getByText("#9 Fix repository workflow cache")).toBeInTheDocument();
    expect(pullSurface.queryByText("#10 Fix repository workflow cache")).not.toBeInTheDocument();

    fireEvent.click(pullSurface.getByRole("button", { name: "Open pull request #9 in Control" }));
    expect(props.onSelectPullRequest).toHaveBeenCalledWith(props.pulls[0]);
  });
});
