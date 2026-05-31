import type {
  GitHubMutationInput,
  WorkflowDefinitionSummary,
  WorkflowJobLogsResult,
  WorkflowRunDetail,
  WorkflowRunSummary
} from "@shared/github";

import { readMockArray, writeMockArray } from "../mockStorage";
import {
  mockAvatarUrl,
  mockPayload,
  mockPayloadNumber,
  mockPayloadString,
  mockPrimaryRepository,
  mockWorkflowRunsKey
} from "./shared";

export const mockActions: WorkflowRunSummary[] = Array.from({ length: 10 }, (_, index) => ({
  id: 9000 + index,
  name: index % 2 === 0 ? "Swift CI" : "Docs",
  displayTitle: index % 2 === 0 ? "Validate compiler changes" : "Publish docs preview",
  runNumber: 4200 + index,
  runAttempt: index % 3 === 0 ? 2 : 1,
  event: index % 2 === 0 ? "pull_request" : "push",
  status: "completed",
  conclusion: index % 4 === 0 ? "failure" : "success",
  branch: "main",
  commitSha: `7f3a2c${index}`,
  headRepositoryNameWithOwner: mockPrimaryRepository.nameWithOwner,
  actorLogin: index % 2 === 0 ? "swift-ci" : "docs-bot",
  actorAvatarUrl: mockAvatarUrl,
  triggeringActorLogin: index % 3 === 0 ? "ashleyrico" : null,
  runStartedAt: new Date(Date.now() - index * 3_600_000 - 900_000).toISOString(),
  createdAt: new Date(Date.now() - index * 3_600_000).toISOString(),
  updatedAt: new Date(Date.now() - index * 3_600_000).toISOString(),
  htmlUrl: `${mockPrimaryRepository.htmlUrl}/actions/runs/${9000 + index}`,
  actionAvailability: {
    canRerun: true,
    canRerunFailedJobs: index % 4 === 0,
    canCancel: false,
    rerunUrl: `${mockPrimaryRepository.htmlUrl}/actions/runs/${9000 + index}/rerun`,
    rerunFailedJobsUrl: `${mockPrimaryRepository.htmlUrl}/actions/runs/${9000 + index}/rerun-failed-jobs`,
    cancelUrl: `${mockPrimaryRepository.htmlUrl}/actions/runs/${9000 + index}/cancel`,
    previousAttemptUrl:
      index % 3 === 0 ? `${mockPrimaryRepository.htmlUrl}/actions/runs/${9000 + index}/attempts/1` : null
  }
}));

export const mockWorkflowRunDetail: WorkflowRunDetail = {
  ...mockActions[0],
  jobs: [
    {
      id: 7100,
      name: "macOS build",
      status: "completed",
      conclusion: "failure",
      startedAt: new Date(Date.now() - 3_600_000).toISOString(),
      completedAt: new Date(Date.now() - 3_300_000).toISOString(),
      htmlUrl: `${mockPrimaryRepository.htmlUrl}/actions/runs/9000/job/7100`,
      runnerName: "macos-15",
      labels: ["macos", "x64"],
      steps: [
        {
          name: "Checkout",
          status: "completed",
          conclusion: "success",
          number: 1,
          startedAt: new Date(Date.now() - 3_600_000).toISOString(),
          completedAt: new Date(Date.now() - 3_590_000).toISOString()
        },
        {
          name: "Build compiler",
          status: "completed",
          conclusion: "failure",
          number: 2,
          startedAt: new Date(Date.now() - 3_580_000).toISOString(),
          completedAt: new Date(Date.now() - 3_300_000).toISOString()
        }
      ]
    }
  ],
  jobsAvailability: { status: "available", message: null },
  artifacts: [
    {
      id: 8100,
      name: "build-logs",
      sizeInBytes: 20480,
      expired: false,
      createdAt: new Date(Date.now() - 3_250_000).toISOString(),
      updatedAt: new Date(Date.now() - 3_250_000).toISOString(),
      expiresAt: new Date(Date.now() + 604_800_000).toISOString(),
      archiveDownloadUrl: "https://pipelines.actions.githubusercontent.com/artifacts/8100.zip",
      archiveDownloadAvailability: { status: "available", message: null }
    }
  ],
  artifactsAvailability: { status: "available", message: null },
  checkSuites: [
    {
      id: 6100,
      status: "completed",
      conclusion: "failure",
      headBranch: "main",
      headSha: "7f3a2c0",
      beforeSha: "123456abcdef",
      afterSha: "7f3a2c0",
      appName: "GitHub Actions",
      appSlug: "github-actions",
      appHtmlUrl: "https://github.com/apps/github-actions",
      latestCheckRunCount: 1,
      createdAt: new Date(Date.now() - 3_600_000).toISOString(),
      updatedAt: new Date(Date.now() - 3_300_000).toISOString()
    }
  ],
  checkSuitesAvailability: { status: "available", message: null },
  checkRuns: [
    {
      id: 6200,
      name: "Swift build",
      status: "completed",
      conclusion: "failure",
      startedAt: new Date(Date.now() - 3_600_000).toISOString(),
      completedAt: new Date(Date.now() - 3_300_000).toISOString(),
      htmlUrl: `${mockPrimaryRepository.htmlUrl}/runs/6200`,
      detailsUrl: `${mockPrimaryRepository.htmlUrl}/actions/runs/9000/job/7100`,
      checkSuiteId: 6100,
      appName: "GitHub Actions",
      appSlug: "github-actions",
      appHtmlUrl: "https://github.com/apps/github-actions",
      outputTitle: "Swift build failed",
      outputSummary: "Compiler tests failed on macOS.",
      outputText: "See the failing build step for details.",
      annotationsCount: 1,
      annotations: [
        {
          path: "Sources/Compiler/main.swift",
          startLine: 42,
          endLine: 42,
          annotationLevel: "failure",
          title: "Compiler test failed",
          message: "Expected diagnostics did not match.",
          rawDetails: "Assertion failed in diagnostics test.",
          blobHref: `${mockPrimaryRepository.htmlUrl}/blob/main/Sources/Compiler/main.swift#L42`
        }
      ],
      annotationsAvailability: { status: "available", message: null }
    }
  ],
  checkRunsAvailability: { status: "available", message: null },
  logs: {
    apiUrl: "https://api.github.com/repos/apple/swift/actions/runs/9000/logs",
    downloadUrl: "https://pipelines.actions.githubusercontent.com/logs.zip",
    available: true,
    message: null,
    availability: { status: "available", message: null }
  }
};

export const mockWorkflows: WorkflowDefinitionSummary[] = [
  {
    id: 5100,
    nodeId: "W_ci",
    name: "Swift CI",
    path: ".github/workflows/ci.yml",
    state: "active",
    htmlUrl: `${mockPrimaryRepository.htmlUrl}/actions/workflows/ci.yml`,
    badgeUrl: `${mockPrimaryRepository.htmlUrl}/actions/workflows/ci.yml/badge.svg`,
    createdAt: new Date(Date.now() - 9_000_000).toISOString(),
    updatedAt: new Date(Date.now() - 3_000_000).toISOString(),
    dispatchable: true,
    inputs: [
      {
        name: "configuration",
        description: "Build configuration",
        required: true,
        type: "choice",
        defaultValue: "debug",
        options: ["debug", "release"]
      },
      {
        name: "run_tests",
        description: "Run the test suite",
        required: false,
        type: "boolean",
        defaultValue: "true",
        options: []
      }
    ],
    inputsUnavailableMessage: null
  }
];

function mockWorkflowActionAvailability(
  run: WorkflowRunSummary
): NonNullable<WorkflowRunSummary["actionAvailability"]> {
  const completed = run.status === null ? null : run.status === "completed";
  const failed = run.conclusion === null ? null : run.conclusion === "failure";
  const rerunUrl = `${run.htmlUrl}/rerun`;
  const rerunFailedJobsUrl = `${run.htmlUrl}/rerun-failed-jobs`;
  const cancelUrl = `${run.htmlUrl}/cancel`;
  const previousAttemptUrl = run.actionAvailability?.previousAttemptUrl
    ? run.actionAvailability.previousAttemptUrl
    : null;

  return {
    canRerun: completed === null ? null : completed,
    canRerunFailedJobs: completed === null || failed === null ? null : completed && failed,
    canCancel: completed === null ? null : !completed,
    rerunUrl,
    rerunFailedJobsUrl,
    cancelUrl,
    previousAttemptUrl:
      previousAttemptUrl && run.runAttempt && run.runAttempt > 1
        ? `${run.htmlUrl}/attempts/${run.runAttempt - 1}`
        : null
  };
}

export function buildMockWorkflowRunDetail(run: WorkflowRunSummary): WorkflowRunDetail {
  const failed = run.conclusion === "failure";
  const completed = run.status === "completed";
  const queued = run.status === "queued";
  const jobStatus = completed ? "completed" : queued ? "queued" : "in_progress";
  const jobConclusion = completed ? run.conclusion : null;

  return {
    ...run,
    actionAvailability: mockWorkflowActionAvailability(run),
    jobs: queued
      ? []
      : [
          {
            id: run.id * 10 + 100,
            name: run.name === "Docs" ? "Docs build" : "macOS build",
            status: jobStatus,
            conclusion: jobConclusion,
            startedAt: run.createdAt,
            completedAt: completed ? run.updatedAt : null,
            htmlUrl: `${run.htmlUrl}/job/${run.id * 10 + 100}`,
            runnerName: run.name === "Docs" ? "ubuntu-24.04" : "macos-15",
            labels: run.name === "Docs" ? ["ubuntu", "x64"] : ["macos", "x64"],
            steps: [
              {
                name: "Checkout",
                status: jobStatus,
                conclusion: completed ? "success" : null,
                number: 1,
                startedAt: run.createdAt,
                completedAt: completed ? run.updatedAt : null
              },
              {
                name: run.name === "Docs" ? "Build docs" : "Build compiler",
                status: jobStatus,
                conclusion: jobConclusion,
                number: 2,
                startedAt: run.createdAt,
                completedAt: completed ? run.updatedAt : null
              }
            ]
          }
        ],
    jobsAvailability: { status: "available", message: null },
    artifacts:
      completed && run.conclusion !== "cancelled"
        ? [
            {
              id: run.id * 10 + 200,
              name: failed ? "build-logs" : "build-output",
              sizeInBytes: failed ? 20480 : 40960,
              expired: false,
              createdAt: run.updatedAt,
              updatedAt: run.updatedAt,
              expiresAt: new Date(Date.now() + 604_800_000).toISOString(),
              archiveDownloadUrl: `https://pipelines.actions.githubusercontent.com/artifacts/${run.id * 10 + 200}.zip`,
              archiveDownloadAvailability: { status: "available", message: null }
            }
          ]
        : [],
    artifactsAvailability: { status: "available", message: null },
    checkSuites: queued
      ? []
      : [
          {
            id: run.id * 10 + 300,
            status: run.status,
            conclusion: run.conclusion,
            headBranch: run.branch,
            headSha: run.commitSha,
            beforeSha: "123456abcdef",
            afterSha: run.commitSha,
            appName: "GitHub Actions",
            appSlug: "github-actions",
            appHtmlUrl: "https://github.com/apps/github-actions",
            latestCheckRunCount: 1,
            createdAt: run.createdAt,
            updatedAt: run.updatedAt
          }
        ],
    checkSuitesAvailability: { status: "available", message: null },
    checkRuns: queued
      ? []
      : [
          {
            id: run.id * 10 + 400,
            name: run.name === "Docs" ? "Docs build" : "Swift build",
            status: run.status,
            conclusion: run.conclusion,
            startedAt: run.createdAt,
            completedAt: completed ? run.updatedAt : null,
            htmlUrl: `${run.htmlUrl}/job/${run.id * 10 + 100}`,
            detailsUrl: `${run.htmlUrl}/job/${run.id * 10 + 100}`,
            checkSuiteId: run.id * 10 + 300,
            appName: "GitHub Actions",
            appSlug: "github-actions",
            appHtmlUrl: "https://github.com/apps/github-actions",
            outputTitle: failed
              ? "Swift build failed"
              : completed
                ? `${run.name} passed`
                : `${run.name} running`,
            outputSummary: failed
              ? "Compiler tests failed on macOS."
              : completed
                ? "All workflow checks passed."
                : "Workflow run is still in progress.",
            outputText: failed ? "See the failing build step for details." : null,
            annotationsCount: failed ? 1 : 0,
            annotations: failed
              ? [
                  {
                    path: "Sources/Compiler/main.swift",
                    startLine: 42,
                    endLine: 42,
                    annotationLevel: "failure",
                    title: "Compiler test failed",
                    message: "Expected diagnostics did not match.",
                    rawDetails: "Assertion failed in diagnostics test.",
                    blobHref: `${mockPrimaryRepository.htmlUrl}/blob/main/Sources/Compiler/main.swift#L42`
                  }
                ]
              : [],
            annotationsAvailability: { status: "available", message: null }
          }
        ],
    checkRunsAvailability: { status: "available", message: null },
    logs: {
      apiUrl: completed ? `https://api.github.com/repos/apple/swift/actions/runs/${run.id}/logs` : null,
      downloadUrl: completed ? "https://pipelines.actions.githubusercontent.com/logs.zip" : null,
      available: completed,
      message: completed ? null : "Logs become available after the run completes.",
      availability: completed
        ? { status: "available", message: null }
        : {
            status: "feature_disabled",
            message: "Logs become available after the run completes."
          }
    }
  };
}

export function readMockWorkflowRuns(): WorkflowRunDetail[] {
  return readMockArray(mockWorkflowRunsKey, () => mockActions.map(buildMockWorkflowRunDetail));
}

export function writeMockWorkflowRuns(items: WorkflowRunDetail[]): void {
  writeMockArray(mockWorkflowRunsKey, items);
}

export function mockWorkflowJobLogs(jobId: number): WorkflowJobLogsResult {
  const text = [
    "2026-05-05T17:01:14.000Z Checkout repository",
    "2026-05-05T17:01:20.000Z Restore build cache",
    "2026-05-05T17:02:31.000Z Build compiler",
    "2026-05-05T17:07:42.000Z error: Expected diagnostics did not match.",
    "2026-05-05T17:07:42.000Z Sources/Compiler/main.swift:42: failed assertion",
    "2026-05-05T17:07:45.000Z Upload build logs"
  ].join("\n");

  return {
    jobId,
    text,
    truncated: false,
    downloadUrl: "https://pipelines.actions.githubusercontent.com/job-log.txt",
    availability: { status: "available", message: null }
  };
}

export function listMockWorkflowRuns(input?: { limit?: number }): WorkflowRunSummary[] {
  return readMockWorkflowRuns()
    .slice(0, input?.limit ?? 20)
    .map(
      ({
        jobs: _jobs,
        artifacts: _artifacts,
        checkSuites: _checkSuites,
        checkRuns: _checkRuns,
        logs: _logs,
        ...run
      }) => run
    );
}

function updateMockWorkflowRunState(
  run: WorkflowRunDetail,
  status: string | null,
  conclusion: string | null,
  updatedAt: string
): WorkflowRunDetail {
  return buildMockWorkflowRunDetail({
    id: run.id,
    name: run.name,
    displayTitle: run.displayTitle,
    runNumber: run.runNumber,
    runAttempt: run.runAttempt,
    event: run.event,
    status,
    conclusion,
    branch: run.branch,
    commitSha: run.commitSha,
    headRepositoryNameWithOwner: run.headRepositoryNameWithOwner,
    actorLogin: run.actorLogin,
    actorAvatarUrl: run.actorAvatarUrl,
    triggeringActorLogin: run.triggeringActorLogin,
    runStartedAt: run.runStartedAt,
    createdAt: run.createdAt,
    updatedAt,
    htmlUrl: run.htmlUrl
  });
}

export function mutateMockWorkflowRuns(input: GitHubMutationInput): void {
  const payload = mockPayload(input);
  const now = new Date().toISOString();

  if (input.action === "dispatchWorkflow") {
    const workflowId = mockPayloadString(payload, "workflowId")?.trim();
    const ref = mockPayloadString(payload, "ref")?.trim() || "main";
    if (!workflowId) {
      return;
    }
    const workflow =
      mockWorkflows.find(
        (item) => item.path === workflowId || item.name === workflowId || String(item.id) === workflowId
      ) ?? mockWorkflows[0];
    const runId = Date.now();
    const run = buildMockWorkflowRunDetail({
      id: runId,
      name: workflow.name,
      displayTitle: `Manual ${workflow.name}`,
      runNumber: runId,
      runAttempt: 1,
      event: "workflow_dispatch",
      status: "queued",
      conclusion: null,
      branch: ref,
      commitSha: null,
      headRepositoryNameWithOwner: `${input.owner}/${input.repo}`,
      actorLogin: "ashleyrico",
      actorAvatarUrl: mockAvatarUrl,
      triggeringActorLogin: "ashleyrico",
      runStartedAt: now,
      createdAt: now,
      updatedAt: now,
      htmlUrl: `https://github.com/${input.owner}/${input.repo}/actions/runs/${runId}`
    });
    writeMockWorkflowRuns([run, ...readMockWorkflowRuns()]);
    return;
  }

  const runId = mockPayloadNumber(payload, "runId");
  const jobId = mockPayloadNumber(payload, "jobId");
  if (runId === null && jobId === null) {
    return;
  }

  const runs = readMockWorkflowRuns();
  const nextRuns = runs.map((run) => {
    const runMatches = runId !== null && run.id === runId;
    const jobMatches = jobId !== null && run.jobs.some((job) => job.id === jobId);
    if (!runMatches && !jobMatches) {
      return run;
    }

    if (
      input.action === "rerunWorkflow" ||
      input.action === "rerunFailedWorkflowJobs" ||
      input.action === "rerunWorkflowJob"
    ) {
      return updateMockWorkflowRunState(run, "queued", null, now);
    }
    if (input.action === "cancelWorkflow") {
      return updateMockWorkflowRunState(run, "completed", "cancelled", now);
    }
    return run;
  });
  writeMockWorkflowRuns(nextRuns);
}
