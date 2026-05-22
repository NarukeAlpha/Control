import { describe, expect, it, vi } from "vitest";

import { mockActions, mockWorkflows, mutateMockWorkflowRuns, readMockWorkflowRuns } from "./actions";
import { installMockDomainTestCleanup } from "./testCleanup";

describe("action mocks", () => {
  installMockDomainTestCleanup();

  it("dispatches workflow runs through the persisted actions domain", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-20T15:00:00.000Z"));

    mutateMockWorkflowRuns({
      action: "dispatchWorkflow",
      owner: "apple",
      repo: "swift",
      workflowId: mockWorkflows[0].path,
      ref: "feature/parser-fixture",
      inputs: {
        configuration: "debug",
        run_tests: "true"
      }
    });

    const createdRun = readMockWorkflowRuns()[0];
    expect(createdRun).toMatchObject({
      name: "Swift CI",
      displayTitle: "Manual Swift CI",
      event: "workflow_dispatch",
      status: "queued",
      conclusion: null,
      branch: "feature/parser-fixture",
      htmlUrl: "https://github.com/apple/swift/actions/runs/1779289200000"
    });
    expect(createdRun.jobs).toEqual([]);
  });

  it("reruns and cancels workflow runs by run id", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-20T15:30:00.000Z"));
    const run = mockActions[0];

    mutateMockWorkflowRuns({
      action: "rerunWorkflow",
      owner: "apple",
      repo: "swift",
      runId: run.id
    });

    const queuedRun = readMockWorkflowRuns().find((item) => item.id === run.id);
    expect(queuedRun).toMatchObject({
      status: "queued",
      conclusion: null,
      updatedAt: "2026-05-20T15:30:00.000Z"
    });

    mutateMockWorkflowRuns({
      action: "cancelWorkflow",
      owner: "apple",
      repo: "swift",
      runId: run.id
    });

    const cancelledRun = readMockWorkflowRuns().find((item) => item.id === run.id);
    expect(cancelledRun).toMatchObject({
      status: "completed",
      conclusion: "cancelled",
      updatedAt: "2026-05-20T15:30:00.000Z"
    });
  });
});
