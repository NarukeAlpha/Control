import { ChevronDown, Download, ExternalLink, Search, Workflow } from "lucide-react";
import { useState, type JSX } from "react";
import { useQuery, type QueryClient } from "@tanstack/react-query";

import type {
  GitHubAction,
  GitHubMutationFields,
  RepositoryDetail,
  WorkflowDefinitionListResult,
  WorkflowDefinitionSummary,
  WorkflowDispatchInputSummary,
  WorkflowJobLogsResult,
  WorkflowRunArtifactSummary,
  WorkflowRunCheckSuiteSummary,
  WorkflowRunDetail,
  WorkflowRunDetailResult,
  WorkflowRunListResult,
  WorkflowRunJobSummary,
  WorkflowRunSummary
} from "@shared/github";
import type { ControlApi } from "@shared/ipc";

import {
  fieldsMatchSearchParts,
  githubActionLabel,
  normalizedSearchParts,
  readAvailabilityMessage,
  repositoryMutationDisabledReason
} from "@renderer/components/repository/repositoryUi";
import { isWorkflowRunAttention } from "@renderer/components/repository/workflows/workflowRunState";
import { useControlApi } from "@renderer/hooks/useControlApi";
import { refreshRepositoryRefsData, useRepositoryRefs } from "@renderer/hooks/useRepositoryRefs";

import { formatCompactNumber, formatRelativeDate } from "@renderer/utils/format";
const maxActionsLimit = 100;
const maxWorkflowDefinitionLimit = 100;

export interface ActionsTabQueryInput {
  owner: string;
  repo: string;
  limit: number;
  enabled: boolean;
  githubReady: boolean;
}

export interface ActionsTabPrefetchInput {
  api: ControlApi;
  owner: string;
  repo: string;
  limit: number;
  githubReady: boolean;
}

export interface ActionsTabRefreshInput extends ActionsTabPrefetchInput {
  selectedRef: string | null;
  defaultBranch?: string | null;
  refListLimit: number;
  workflowDefinitionLimit: number;
  focusedWorkflowRunId: number | null;
}

export function actionsTabQueryKey(
  owner: string,
  repo: string,
  limit: number
): readonly ["actions", string, string, number] {
  return ["actions", owner, repo, limit] as const;
}

export function workflowDefinitionsQueryKey(
  owner: string,
  repo: string,
  ref: string | null | undefined,
  limit: number
): readonly ["workflows", string, string, string, number] {
  return ["workflows", owner, repo, ref || "default", limit] as const;
}

export function workflowRunDetailQueryKey(
  owner: string,
  repo: string,
  runId: number | null
): readonly ["action-detail", string, string, number | "none"] {
  return ["action-detail", owner, repo, runId ?? "none"] as const;
}

export function useActionsTabQueries({ owner, repo, limit, enabled, githubReady }: ActionsTabQueryInput) {
  const api = useControlApi();

  const actions = useQuery<WorkflowRunListResult>({
    queryKey: actionsTabQueryKey(owner, repo, limit),
    queryFn: () => api.github.listActionsWithStatus({ owner, repo, limit, cacheOnly: !githubReady }),
    enabled,
    staleTime: 60_000
  });

  return { actions };
}

export async function prefetchActionsTabData(
  queryClient: QueryClient,
  { api, owner, repo, limit, githubReady }: ActionsTabPrefetchInput
): Promise<void> {
  await queryClient.prefetchQuery({
    queryKey: actionsTabQueryKey(owner, repo, limit),
    queryFn: () => api.github.listActionsWithStatus({ owner, repo, limit, cacheOnly: !githubReady }),
    staleTime: 60_000
  });
}

export async function refreshActionsTabData(
  queryClient: QueryClient,
  {
    api,
    owner,
    repo,
    limit,
    selectedRef,
    defaultBranch,
    refListLimit,
    workflowDefinitionLimit,
    focusedWorkflowRunId,
    githubReady
  }: ActionsTabRefreshInput
): Promise<void> {
  const cachedRead = !githubReady;
  const ref = selectedRef ?? defaultBranch ?? undefined;
  const refreshes: Array<Promise<unknown>> = [
    queryClient.fetchQuery({
      queryKey: actionsTabQueryKey(owner, repo, limit),
      staleTime: 0,
      queryFn: () =>
        api.github.listActionsWithStatus({
          owner,
          repo,
          limit,
          cacheOnly: cachedRead,
          forceRefresh: !cachedRead
        })
    }),
    refreshRepositoryRefsData(queryClient, { api, owner, repo, limit: refListLimit, githubReady }),
    queryClient.fetchQuery({
      queryKey: workflowDefinitionsQueryKey(owner, repo, ref, workflowDefinitionLimit),
      staleTime: 0,
      queryFn: () =>
        api.github.listWorkflowsWithStatus({
          owner,
          repo,
          ref: ref ?? null,
          limit: workflowDefinitionLimit,
          cacheOnly: cachedRead,
          forceRefresh: !cachedRead
        })
    })
  ];

  if (focusedWorkflowRunId !== null) {
    refreshes.push(
      queryClient.fetchQuery({
        queryKey: workflowRunDetailQueryKey(owner, repo, focusedWorkflowRunId),
        staleTime: 0,
        queryFn: () =>
          api.github.getWorkflowRunDetailWithStatus({
            owner,
            repo,
            runId: focusedWorkflowRunId,
            cacheOnly: cachedRead,
            forceRefresh: !cachedRead
          })
      })
    );
  }

  try {
    await Promise.all(refreshes);
  } catch {
    // React Query owns the visible error state for this refresh.
  }
}

function workflowRerunDisabledReason(repository: RepositoryDetail, run: WorkflowRunSummary): string | null {
  const repositoryReason = repositoryMutationDisabledReason(repository);
  if (repositoryReason) {
    return repositoryReason;
  }
  if (run.actionAvailability?.canRerun === false) {
    return run.actionAvailability.rerunUrl
      ? "Only completed workflow runs can be rerun."
      : "GitHub did not return a workflow rerun endpoint.";
  }
  if (run.actionAvailability?.canRerun === true) {
    return null;
  }
  if (run.status !== "completed") {
    return "Only completed workflow runs can be rerun.";
  }
  return null;
}

function workflowFailedJobsRerunDisabledReason(
  repository: RepositoryDetail,
  run: WorkflowRunSummary
): string | null {
  const repositoryReason = repositoryMutationDisabledReason(repository);
  if (repositoryReason) {
    return repositoryReason;
  }
  if (run.actionAvailability?.canRerunFailedJobs === false) {
    return run.actionAvailability.rerunFailedJobsUrl
      ? "Only failed workflow runs can rerun failed jobs."
      : "GitHub did not return a failed-job rerun endpoint.";
  }
  if (run.actionAvailability?.canRerunFailedJobs === true) {
    return null;
  }
  if (run.status !== "completed") {
    return "Only completed workflow runs can be rerun.";
  }
  if (run.conclusion !== "failure") {
    return "Only failed workflow runs can rerun failed jobs.";
  }
  return null;
}

function workflowJobRerunDisabledReason(
  repository: RepositoryDetail,
  job: WorkflowRunJobSummary
): string | null {
  const repositoryReason = repositoryMutationDisabledReason(repository);
  if (repositoryReason) {
    return repositoryReason;
  }
  if (job.status !== "completed") {
    return "Only completed workflow jobs can be rerun.";
  }
  return null;
}

function workflowCancelDisabledReason(repository: RepositoryDetail, run: WorkflowRunSummary): string | null {
  const repositoryReason = repositoryMutationDisabledReason(repository);
  if (repositoryReason) {
    return repositoryReason;
  }
  if (run.actionAvailability?.canCancel === false) {
    return run.actionAvailability.cancelUrl
      ? "Completed workflow runs cannot be canceled."
      : "GitHub did not return a workflow cancel endpoint.";
  }
  if (run.actionAvailability?.canCancel === true) {
    return null;
  }
  if (run.status === "completed") {
    return "Completed workflow runs cannot be canceled.";
  }
  return null;
}

function workflowActionAvailabilityLabel(value: boolean | null | undefined): string {
  if (value === true) {
    return "available";
  }
  if (value === false) {
    return "unavailable";
  }
  return "unknown";
}

type WorkflowDispatchInputValues = Record<string, string | boolean>;

function workflowInputDefaults(inputs: WorkflowDispatchInputSummary[]): WorkflowDispatchInputValues {
  return inputs.reduce<WorkflowDispatchInputValues>((values, input) => {
    if (input.type === "boolean") {
      values[input.name] = input.defaultValue?.toLowerCase() === "true";
    } else {
      values[input.name] = input.defaultValue ?? "";
    }
    return values;
  }, {});
}

function workflowDispatchInputsPayload(
  inputs: WorkflowDispatchInputSummary[],
  values: WorkflowDispatchInputValues
): Record<string, string | boolean> {
  return inputs.reduce<Record<string, string | boolean>>((payload, input) => {
    const value = values[input.name];
    if (input.type === "boolean") {
      payload[input.name] = Boolean(value);
    } else if (typeof value === "string" && value.trim()) {
      payload[input.name] = value.trim();
    }
    return payload;
  }, {});
}

type WorkflowFailureSummaryItem = {
  id: string;
  kind: "Run" | "Job" | "Step" | "Check" | "Annotation";
  title: string;
  detail: string;
  state: string;
  url?: string | null;
  jobId?: number;
  path?: string | null;
  line?: number | null;
};

const workflowFailureStates = new Set([
  "failure",
  "cancelled",
  "timed_out",
  "startup_failure",
  "action_required"
]);

function isWorkflowFailureState(value: string | null | undefined): boolean {
  return Boolean(value && workflowFailureStates.has(value));
}

function compactWorkflowFailureText(value: string | null | undefined, fallback: string): string {
  const text = value?.replace(/\s+/g, " ").trim();
  if (!text) {
    return fallback;
  }
  return text.length > 180 ? `${text.slice(0, 177)}...` : text;
}

function workflowFailureSummary(detail: WorkflowRunDetail | undefined): WorkflowFailureSummaryItem[] {
  if (!detail) {
    return [];
  }

  const items: WorkflowFailureSummaryItem[] = [];
  const addItem = (item: WorkflowFailureSummaryItem): void => {
    if (items.length < 8) {
      items.push(item);
    }
  };

  detail.jobs.forEach((job) => {
    const jobState = job.conclusion ?? job.status ?? "unknown";
    if (isWorkflowFailureState(jobState)) {
      addItem({
        id: `job-${job.id}`,
        kind: "Job",
        title: job.name,
        detail: `${job.runnerName ?? "GitHub runner"} reported ${jobState}.`,
        state: jobState,
        url: job.htmlUrl,
        jobId: job.id
      });
    }

    job.steps
      .filter((step) => isWorkflowFailureState(step.conclusion ?? step.status))
      .slice(0, 2)
      .forEach((step) => {
        const stepState = step.conclusion ?? step.status ?? "unknown";
        addItem({
          id: `step-${job.id}-${step.number}`,
          kind: "Step",
          title: step.name,
          detail: `${job.name} step ${step.number} reported ${stepState}.`,
          state: stepState,
          url: job.htmlUrl,
          jobId: job.id
        });
      });
  });

  detail.checkRuns.forEach((checkRun) => {
    const checkState = checkRun.conclusion ?? checkRun.status ?? "unknown";
    if (isWorkflowFailureState(checkState)) {
      addItem({
        id: `check-${checkRun.id}`,
        kind: "Check",
        title: checkRun.name,
        detail: compactWorkflowFailureText(
          checkRun.outputTitle ?? checkRun.outputSummary ?? checkRun.outputText,
          `${checkRun.appName ?? "GitHub Checks"} reported ${checkState}.`
        ),
        state: checkState,
        url: checkRun.detailsUrl ?? checkRun.htmlUrl
      });
    }

    checkRun.annotations
      .filter(
        (annotation) => annotation.annotationLevel === "failure" || annotation.annotationLevel === "warning"
      )
      .slice(0, 2)
      .forEach((annotation, index) => {
        addItem({
          id: `annotation-${checkRun.id}-${annotation.path}-${annotation.startLine ?? index}`,
          kind: "Annotation",
          title: annotation.title ?? checkRun.name,
          detail: compactWorkflowFailureText(
            annotation.message,
            `${annotation.path}${annotation.startLine ? `:${annotation.startLine}` : ""}`
          ),
          state: annotation.annotationLevel ?? "annotation",
          url: annotation.blobHref,
          path: annotation.path,
          line: annotation.startLine
        });
      });
  });

  if (items.length === 0 && isWorkflowFailureState(detail.conclusion)) {
    addItem({
      id: `run-${detail.id}`,
      kind: "Run",
      title: detail.name,
      detail: "GitHub did not return failed jobs, checks, or annotations for this run.",
      state: detail.conclusion ?? "failed",
      url: detail.htmlUrl
    });
  }

  return items;
}

function workflowDispatchDisabledReason(
  workflow: WorkflowDefinitionSummary | null,
  workflowId: string,
  ref: string,
  values: WorkflowDispatchInputValues
): string | null {
  if (!workflowId.trim()) {
    return "Workflow dispatch requires a workflow file, name, or id.";
  }
  if (!ref.trim()) {
    return "Workflow dispatch requires a branch or tag.";
  }
  if (workflow && !workflow.dispatchable) {
    return "Selected workflow does not define workflow_dispatch.";
  }

  const missingInput = workflow?.inputs.find((input) => {
    const value = values[input.name];
    return input.required && input.type !== "boolean" && !(typeof value === "string" && value.trim());
  });
  return missingInput ? `${missingInput.name} is required.` : null;
}

export function ActionsTab({
  repository,
  githubReady,
  selectedRef,
  refListLimit,
  actionsLimit,
  workflowDefinitionLimit,
  focusedWorkflowRunId,
  focusedWorkflowArtifactId,
  initialFilter,
  initialDispatching,
  mutationAction,
  mutationPending,
  mutationSucceeded,
  mutationError,
  onOpenExternal,
  onOpenWorkflowRunCommit,
  onOpenWorkflowCheckSuiteCommit,
  onOpenCodePath,
  onSelectWorkflowRun,
  onSelectWorkflowArtifact,
  onExpandActions,
  onExpandWorkflowDefinitions,
  onMutate
}: {
  repository: RepositoryDetail;
  githubReady: boolean;
  selectedRef: string | null;
  refListLimit: number;
  actionsLimit: number;
  workflowDefinitionLimit: number;
  focusedWorkflowRunId: number | null;
  focusedWorkflowArtifactId: number | null;
  initialFilter: string;
  initialDispatching: boolean;
  mutationAction: GitHubAction | null;
  mutationPending: boolean;
  mutationSucceeded: boolean;
  mutationError: Error | null;
  onOpenExternal(url: string): void;
  onOpenWorkflowRunCommit(
    run: WorkflowRunSummary | WorkflowRunDetail,
    targetRepositoryNameWithOwner?: string | null
  ): void;
  onOpenWorkflowCheckSuiteCommit(
    suite: WorkflowRunCheckSuiteSummary,
    targetRepositoryNameWithOwner?: string | null
  ): void;
  onOpenCodePath(
    path: string,
    ref: string | null,
    blobUrl?: string | null,
    line?: number | null,
    targetRepositoryNameWithOwner?: string | null
  ): void;
  onSelectWorkflowRun(run: WorkflowRunSummary): void;
  onSelectWorkflowArtifact(
    run: WorkflowRunSummary | WorkflowRunDetail,
    artifact: WorkflowRunArtifactSummary
  ): void;
  onExpandActions(): void;
  onExpandWorkflowDefinitions(): void;
  onMutate(action: GitHubAction, dangerous: boolean, payload?: GitHubMutationFields): void;
}): JSX.Element {
  const { actions: actionsQuery } = useActionsTabQueries({
    owner: repository.owner,
    repo: repository.name,
    limit: actionsLimit,
    enabled: true,
    githubReady
  });
  const {
    branchItems: branches,
    tagItems: tags,
    error: refsError,
    availabilityMessage: refsAvailabilityMessage
  } = useRepositoryRefs(repository.owner, repository.name, true, refListLimit, { githubReady });
  const actions = actionsQuery.data?.items ?? [];
  const availability = actionsQuery.data?.availability ?? null;
  const loading = actionsQuery.isLoading || actionsQuery.isFetching;
  const error = actionsQuery.error;
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [filter, setFilter] = useState(initialFilter);
  const [dispatching, setDispatching] = useState(initialDispatching);
  const [workflowId, setWorkflowId] = useState("");
  const [ref, setRef] = useState(selectedRef ?? repository.defaultBranch ?? "main");
  const [workflowInputOverrides, setWorkflowInputOverrides] = useState<WorkflowDispatchInputValues>({});
  const [selectedLogJobSelection, setSelectedLogJobSelection] = useState<{
    runId: number;
    jobId: number;
  } | null>(null);
  const [jobLogPreviewSizeSelection, setJobLogPreviewSizeSelection] = useState<{
    key: string;
    maxCharacters: number;
  } | null>(null);
  const [submittedWorkflowAction, setSubmittedWorkflowAction] = useState<GitHubAction | null>(null);
  const liveWorkflowDisabledReason = !githubReady ? "Sign in with GitHub to run workflow actions." : null;
  const repositoryDispatchDisabledReason =
    liveWorkflowDisabledReason ?? repositoryMutationDisabledReason(repository);
  const workflowMutationAction =
    mutationAction === "dispatchWorkflow" ||
    mutationAction === "rerunWorkflow" ||
    mutationAction === "rerunFailedWorkflowJobs" ||
    mutationAction === "rerunWorkflowJob" ||
    mutationAction === "cancelWorkflow"
      ? mutationAction
      : null;
  const workflowActionPendingReason =
    mutationPending && workflowMutationAction
      ? `${githubActionLabel(workflowMutationAction)} is still running.`
      : null;
  const workflowRefOptions = [
    ...branches.map((branch) => ({ label: branch.name, group: "Branches" })),
    ...tags.map((tag) => ({ label: tag.name, group: "Tags" }))
  ];
  const filterParts = normalizedSearchParts(filter);
  const requiresAttentionFilter = filterParts.includes("attention");
  const actionSearchParts = filterParts.filter((part) => part !== "attention");
  const actionsLimitHit = actions.length >= actionsLimit;
  const canExpandActions = actionsLimitHit && actionsLimit < maxActionsLimit;
  const filteredActions = actions.filter((run) => {
    return (
      (!requiresAttentionFilter || isWorkflowRunAttention(run)) &&
      fieldsMatchSearchParts(
        [
          run.id,
          run.name,
          run.displayTitle,
          run.event,
          run.status,
          run.conclusion,
          run.branch,
          run.commitSha,
          run.actorLogin,
          run.triggeringActorLogin,
          run.headRepositoryNameWithOwner,
          run.conclusion === "failure" ? "failed failure" : null,
          run.conclusion === "success" ? "passed success" : null,
          run.status === "in_progress" ? "running in progress" : null
        ],
        actionSearchParts
      )
    );
  });
  const requestedRunId = selectedRunId ?? focusedWorkflowRunId;
  const selectedRunMatchesFilter =
    requestedRunId !== null && filteredActions.some((run) => run.id === requestedRunId);
  const effectiveSelectedRunId = selectedRunMatchesFilter ? requestedRunId : (filteredActions[0]?.id ?? null);
  const selectedRunFromList =
    effectiveSelectedRunId !== null
      ? (filteredActions.find((run) => run.id === effectiveSelectedRunId) ?? null)
      : null;
  const initialExpandedWorkflowDetailItems = {
    jobStepIds: new Set<number>(),
    checkAnnotationIds: new Set<number>()
  };
  const workflowListLimit = 6;
  const workflowDetailKey =
    effectiveSelectedRunId !== null ? `${repository.nameWithOwner}#${effectiveSelectedRunId}` : null;
  const [expandedWorkflowDetailState, setExpandedWorkflowDetailState] = useState({
    detailKey: workflowDetailKey,
    items: initialExpandedWorkflowDetailItems
  });
  const expandedWorkflowDetailItems =
    expandedWorkflowDetailState.detailKey === workflowDetailKey
      ? expandedWorkflowDetailState.items
      : initialExpandedWorkflowDetailItems;
  const api = useControlApi();
  const workflows = useQuery<WorkflowDefinitionListResult>({
    queryKey: workflowDefinitionsQueryKey(repository.owner, repository.name, ref, workflowDefinitionLimit),
    queryFn: () =>
      api.github.listWorkflowsWithStatus({
        owner: repository.owner,
        repo: repository.name,
        ref: ref.trim() || null,
        limit: workflowDefinitionLimit,
        cacheOnly: !githubReady
      }),
    enabled: dispatching && !repositoryDispatchDisabledReason,
    staleTime: 120_000
  });
  const runDetail = useQuery<WorkflowRunDetailResult>({
    queryKey: workflowRunDetailQueryKey(repository.owner, repository.name, effectiveSelectedRunId),
    queryFn: () =>
      api.github.getWorkflowRunDetailWithStatus({
        owner: repository.owner,
        repo: repository.name,
        runId: effectiveSelectedRunId!,
        cacheOnly: !githubReady
      }),
    enabled: Boolean(effectiveSelectedRunId !== null && !dispatching),
    staleTime: 60_000
  });
  const workflowItems = workflows.data?.items ?? [];
  const workflowDefinitionsAvailability = workflows.data?.availability ?? null;
  const workflowDefinitionsAvailabilityMessage = readAvailabilityMessage(
    "Workflow definitions",
    workflowDefinitionsAvailability
  );
  const detail = runDetail.data?.detail ?? null;
  const workflowRunDetailAvailability = runDetail.data?.availability ?? null;
  const workflowRunDetailAvailabilityMessage = readAvailabilityMessage(
    "Run detail",
    workflowRunDetailAvailability
  );
  const selectedRun = selectedRunFromList ?? detail ?? null;
  const selectedWorkflowArtifact =
    detail && focusedWorkflowArtifactId !== null
      ? (detail.artifacts.find((artifact) => artifact.id === focusedWorkflowArtifactId) ?? null)
      : null;
  const selectedRunTargetRepositoryNameWithOwner =
    selectedRun?.headRepositoryNameWithOwner ?? repository.nameWithOwner;
  const selectedRunSourceRepositoryNameWithOwner =
    selectedRun?.headRepositoryNameWithOwner &&
    selectedRun.headRepositoryNameWithOwner !== repository.nameWithOwner
      ? selectedRun.headRepositoryNameWithOwner
      : null;
  const selectedLogJob =
    selectedLogJobSelection && selectedRun && selectedLogJobSelection.runId === selectedRun.id
      ? (detail?.jobs.find((job) => job.id === selectedLogJobSelection.jobId) ?? null)
      : null;
  const defaultJobLogPreviewCharacters = 12_000;
  const largeJobLogPreviewCharacters = 50_000;
  const selectedLogJobKey =
    selectedRun && selectedLogJob
      ? `${repository.nameWithOwner}#${selectedRun.id}#${selectedLogJob.id}`
      : null;
  const jobLogPreviewCharacters =
    selectedLogJobKey && jobLogPreviewSizeSelection?.key === selectedLogJobKey
      ? jobLogPreviewSizeSelection.maxCharacters
      : defaultJobLogPreviewCharacters;
  const jobLogs = useQuery<WorkflowJobLogsResult>({
    queryKey: [
      "workflow-job-logs",
      repository.owner,
      repository.name,
      selectedRun?.id ?? "none",
      selectedLogJob?.id ?? "none",
      jobLogPreviewCharacters
    ],
    queryFn: () =>
      api.github.getWorkflowJobLogs({
        owner: repository.owner,
        repo: repository.name,
        jobId: selectedLogJob!.id,
        maxCharacters: jobLogPreviewCharacters,
        cacheOnly: !githubReady
      }),
    enabled: Boolean(selectedLogJob && !dispatching),
    staleTime: 30_000
  });
  const selectedRerunDisabledReason = selectedRun
    ? (workflowActionPendingReason ??
      liveWorkflowDisabledReason ??
      workflowRerunDisabledReason(repository, selectedRun))
    : null;
  const selectedFailedJobsRerunDisabledReason = selectedRun
    ? (workflowActionPendingReason ??
      liveWorkflowDisabledReason ??
      workflowFailedJobsRerunDisabledReason(repository, selectedRun))
    : null;
  const selectedCancelDisabledReason = selectedRun
    ? (workflowActionPendingReason ??
      liveWorkflowDisabledReason ??
      workflowCancelDisabledReason(repository, selectedRun))
    : null;
  const firstWorkflow = workflowItems.find((workflow) => workflow.dispatchable) ?? workflowItems[0] ?? null;
  const effectiveWorkflowId = workflowId || firstWorkflow?.path || "";
  const selectedWorkflow =
    workflowItems.find(
      (workflow) =>
        workflow.path === effectiveWorkflowId ||
        String(workflow.id) === effectiveWorkflowId ||
        workflow.name === effectiveWorkflowId
    ) ?? null;
  const workflowInputValues = selectedWorkflow
    ? { ...workflowInputDefaults(selectedWorkflow.inputs), ...workflowInputOverrides }
    : {};
  const dispatchDisabledReason =
    workflowActionPendingReason ??
    repositoryDispatchDisabledReason ??
    workflowDispatchDisabledReason(selectedWorkflow, effectiveWorkflowId, ref, workflowInputValues);
  const dispatchConfigurationDisabled = Boolean(
    workflowActionPendingReason ?? repositoryDispatchDisabledReason
  );
  const dispatchMutationActive =
    submittedWorkflowAction === "dispatchWorkflow" && mutationAction === "dispatchWorkflow";
  const workflowRunMutationActive =
    submittedWorkflowAction !== null &&
    submittedWorkflowAction !== "dispatchWorkflow" &&
    mutationAction === submittedWorkflowAction;
  const workflowDefinitionsEmpty =
    Boolean(dispatching && workflows.data && workflowItems.length === 0) && !workflows.isLoading;
  const workflowDefinitionsLimitHit = workflowItems.length >= workflowDefinitionLimit;
  const canExpandWorkflowDefinitions =
    workflowDefinitionsLimitHit && workflowDefinitionLimit < maxWorkflowDefinitionLimit;
  const manualWorkflowInputMetadataUnavailable =
    Boolean(effectiveWorkflowId.trim()) && !selectedWorkflow && !workflows.isLoading;
  const failureSummary = workflowFailureSummary(detail ?? undefined);
  const actionsAvailabilityMessage = readAvailabilityMessage("Workflow runs", availability);
  const jobLogsAvailabilityMessage = readAvailabilityMessage("Job logs", jobLogs.data?.availability ?? null);
  const workflowJobsAvailabilityMessage = readAvailabilityMessage(
    "Workflow jobs",
    detail?.jobsAvailability ?? null
  );
  const workflowArtifactsAvailabilityMessage = readAvailabilityMessage(
    "Workflow artifacts",
    detail?.artifactsAvailability ?? null
  );
  const workflowCheckSuitesAvailabilityMessage = readAvailabilityMessage(
    "Workflow check suites",
    detail?.checkSuitesAvailability ?? null
  );
  const workflowCheckRunsAvailabilityMessage = readAvailabilityMessage(
    "Workflow check runs",
    detail?.checkRunsAvailability ?? null
  );

  function submitWorkflowMutation(
    action: GitHubAction,
    dangerous: boolean,
    payload?: GitHubMutationFields
  ): void {
    setSubmittedWorkflowAction(action);
    onMutate(action, dangerous, payload);
  }

  return (
    <section className="table-panel github-surface">
      <div className="table-action-row surface-filter-row">
        <label className="surface-filter">
          <Search size={15} />
          <input
            aria-label="Filter workflow runs"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter workflow runs"
          />
        </label>
        <button
          type="button"
          disabled={Boolean(workflowActionPendingReason ?? repositoryDispatchDisabledReason)}
          title={workflowActionPendingReason ?? repositoryDispatchDisabledReason ?? undefined}
          onClick={() => {
            setSubmittedWorkflowAction(null);
            setDispatching(true);
          }}
        >
          <Workflow size={16} /> Run workflow
        </button>
      </div>
      <div className="github-split">
        <div className="thread-list">
          {loading && actions.length === 0 && <div className="loading-state">Loading workflow runs…</div>}
          {error && <div className="error-state">Workflow runs unavailable: {error.message}</div>}
          {actionsAvailabilityMessage && <div className="error-state">{actionsAvailabilityMessage}</div>}
          {canExpandActions && (
            <div className="table-action-row">
              <button type="button" onClick={onExpandActions}>
                <ChevronDown size={16} /> Load more runs
              </button>
            </div>
          )}
          {!canExpandActions && actionsLimitHit && (
            <div className="muted-row">
              Showing the first {actions.length} workflow runs returned by GitHub.
            </div>
          )}
          {filteredActions.map((run) => {
            const sourceRepositoryNameWithOwner =
              run.headRepositoryNameWithOwner && run.headRepositoryNameWithOwner !== repository.nameWithOwner
                ? run.headRepositoryNameWithOwner
                : null;
            const workflowRunMetadata = [
              run.name,
              run.runNumber ? `#${run.runNumber}` : null,
              `${run.event} on ${run.branch ?? "unknown"}`,
              sourceRepositoryNameWithOwner ? `Source ${sourceRepositoryNameWithOwner}` : null,
              run.actorLogin ? `by ${run.actorLogin}` : null,
              run.triggeringActorLogin && run.triggeringActorLogin !== run.actorLogin
                ? `triggered by ${run.triggeringActorLogin}`
                : null,
              run.runAttempt ? `attempt ${run.runAttempt}` : null,
              run.runStartedAt
                ? `started ${formatRelativeDate(run.runStartedAt)}`
                : formatRelativeDate(run.updatedAt)
            ].filter(Boolean);

            return (
              <div
                className={`issue-row thread-list-action-row ${
                  selectedRun?.id === run.id && !dispatching ? "active" : ""
                }`}
                key={run.id}
              >
                <button
                  className="thread-list-row-main"
                  type="button"
                  onClick={() => {
                    setDispatching(false);
                    setSelectedRunId(run.id);
                    onSelectWorkflowRun(run);
                  }}
                >
                  <Workflow size={17} />
                  <div className="workflow-run-copy">
                    <strong>{run.displayTitle ?? run.name}</strong>
                    <small>{workflowRunMetadata.join(" · ")}</small>
                  </div>
                  <div className="thread-list-row-badges">
                    <span className={`state-chip ${run.conclusion === "success" ? "success" : ""}`}>
                      {run.conclusion ?? run.status ?? "queued"}
                    </span>
                    {run.actionAvailability?.canRerun === true && <span className="state-chip">rerun</span>}
                    {run.actionAvailability?.canRerunFailedJobs === true && (
                      <span className="state-chip">rerun failed</span>
                    )}
                    {run.actionAvailability?.canCancel === true && <span className="state-chip">cancel</span>}
                  </div>
                </button>
                <button
                  className="pin-row-button"
                  type="button"
                  aria-label={`Open workflow run ${run.displayTitle ?? run.name} GitHub fallback`}
                  title="GitHub fallback for workflow run"
                  onClick={() => onOpenExternal(run.htmlUrl)}
                >
                  <ExternalLink size={15} />
                </button>
              </div>
            );
          })}
          {!loading && !actionsAvailabilityMessage && filteredActions.length === 0 && (
            <div className="empty-state">
              {filter.trim()
                ? "No workflow runs match this filter."
                : "No workflow runs returned for this repository."}
            </div>
          )}
        </div>

        <div className="thread-detail">
          {dispatching ? (
            <form
              className="compose-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (dispatchDisabledReason || !effectiveWorkflowId.trim() || !ref.trim()) {
                  return;
                }
                const inputs = selectedWorkflow
                  ? workflowDispatchInputsPayload(selectedWorkflow.inputs, workflowInputValues)
                  : {};
                const workflowDispatchId = selectedWorkflow?.path ?? effectiveWorkflowId.trim();
                setSubmittedWorkflowAction("dispatchWorkflow");
                onMutate("dispatchWorkflow", true, {
                  workflowId: workflowDispatchId,
                  ref: ref.trim(),
                  ...(Object.keys(inputs).length > 0 ? { inputs } : {})
                });
              }}
            >
              <h2>Run workflow</h2>
              {dispatchMutationActive && mutationPending && (
                <div className="loading-state">
                  {githubActionLabel("dispatchWorkflow")} is running. Workflow inputs are locked until GitHub
                  responds.
                </div>
              )}
              {dispatchMutationActive && !mutationPending && mutationSucceeded && (
                <div className="success-state">
                  {githubActionLabel("dispatchWorkflow")} completed. Workflow runs are refreshing.
                </div>
              )}
              {dispatchMutationActive && !mutationPending && mutationError && (
                <div className="error-state">
                  {githubActionLabel("dispatchWorkflow")} failed: {mutationError.message}
                </div>
              )}
              {workflows.isLoading && <div className="loading-state">Loading workflows…</div>}
              {workflows.error && (
                <div className="error-state">Workflow definitions unavailable: {workflows.error.message}</div>
              )}
              {workflowDefinitionsAvailabilityMessage && (
                <div className="error-state">{workflowDefinitionsAvailabilityMessage}</div>
              )}
              {!workflows.error && workflowDefinitionsEmpty && (
                <div className="empty-state">
                  No workflow definitions returned. Enter a workflow file, name, or id manually.
                </div>
              )}
              {workflowItems.length > 0 ? (
                <select
                  aria-label="Workflow"
                  disabled={dispatchConfigurationDisabled}
                  title={repositoryDispatchDisabledReason ?? undefined}
                  value={effectiveWorkflowId}
                  onChange={(event) => {
                    setWorkflowId(event.target.value);
                    setWorkflowInputOverrides({});
                  }}
                >
                  {workflowItems.map((workflow) => (
                    <option key={workflow.id} value={workflow.path}>
                      {workflow.name} ({workflow.path})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  disabled={dispatchConfigurationDisabled}
                  title={repositoryDispatchDisabledReason ?? undefined}
                  value={workflowId}
                  onChange={(event) => setWorkflowId(event.target.value)}
                  placeholder="workflow file, name, or id"
                />
              )}
              {canExpandWorkflowDefinitions && (
                <div className="table-action-row">
                  <button type="button" disabled={workflows.isFetching} onClick={onExpandWorkflowDefinitions}>
                    <ChevronDown size={16} />{" "}
                    {workflows.isFetching ? "Loading workflows…" : "Load more workflows"}
                  </button>
                </div>
              )}
              {!canExpandWorkflowDefinitions && workflowDefinitionsLimitHit && (
                <small className="action-disabled-note">
                  Showing the first {workflowItems.length || workflowDefinitionLimit} workflow definitions
                  returned by GitHub.
                </small>
              )}
              {manualWorkflowInputMetadataUnavailable && (
                <small className="action-disabled-note">
                  Dispatch inputs are unavailable for the manually entered workflow.
                </small>
              )}
              <input
                disabled={dispatchConfigurationDisabled}
                title={repositoryDispatchDisabledReason ?? undefined}
                value={ref}
                list={`workflow-dispatch-refs-${repository.id}`}
                onChange={(event) => setRef(event.target.value)}
                placeholder="branch or tag"
              />
              <datalist id={`workflow-dispatch-refs-${repository.id}`}>
                {workflowRefOptions.map((option) => (
                  <option key={`${option.group}-${option.label}`} value={option.label}>
                    {option.group}
                  </option>
                ))}
              </datalist>
              {refsError && (
                <small className="action-disabled-note">
                  Branch and tag suggestions unavailable: {refsError.message}
                </small>
              )}
              {refsAvailabilityMessage && (
                <small className="action-disabled-note">{refsAvailabilityMessage}</small>
              )}
              {selectedWorkflow && (
                <div className="workflow-input-grid">
                  <small>
                    {selectedWorkflow.dispatchable
                      ? `${selectedWorkflow.inputs.length} dispatch inputs`
                      : (selectedWorkflow.inputsUnavailableMessage ?? "Workflow dispatch is not enabled.")}
                  </small>
                  {selectedWorkflow.inputs.map((input) => (
                    <label key={input.name}>
                      <span>
                        {input.name}
                        {input.required ? " *" : ""}
                      </span>
                      {input.description && <small>{input.description}</small>}
                      {input.type === "boolean" ? (
                        <input
                          checked={Boolean(workflowInputValues[input.name])}
                          disabled={dispatchConfigurationDisabled}
                          title={repositoryDispatchDisabledReason ?? undefined}
                          type="checkbox"
                          onChange={(event) =>
                            setWorkflowInputOverrides((current) => ({
                              ...current,
                              [input.name]: event.target.checked
                            }))
                          }
                        />
                      ) : input.type === "choice" && input.options.length > 0 ? (
                        <select
                          aria-label={input.name}
                          disabled={dispatchConfigurationDisabled}
                          title={repositoryDispatchDisabledReason ?? undefined}
                          value={String(workflowInputValues[input.name] ?? "")}
                          onChange={(event) =>
                            setWorkflowInputOverrides((current) => ({
                              ...current,
                              [input.name]: event.target.value
                            }))
                          }
                        >
                          {!input.required && <option value="">Default</option>}
                          {input.options.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          disabled={dispatchConfigurationDisabled}
                          title={repositoryDispatchDisabledReason ?? undefined}
                          value={String(workflowInputValues[input.name] ?? "")}
                          type={input.type === "number" ? "number" : "text"}
                          onChange={(event) =>
                            setWorkflowInputOverrides((current) => ({
                              ...current,
                              [input.name]: event.target.value
                            }))
                          }
                        />
                      )}
                    </label>
                  ))}
                </div>
              )}
              <div>
                <button
                  className="dark-action"
                  type="submit"
                  disabled={Boolean(dispatchDisabledReason)}
                  title={dispatchDisabledReason ?? undefined}
                >
                  <Workflow size={16} /> Run workflow
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSubmittedWorkflowAction(null);
                    setDispatching(false);
                  }}
                >
                  Cancel
                </button>
                {dispatchDisabledReason && (
                  <small className="action-disabled-note">
                    Dispatch unavailable: {dispatchDisabledReason}
                  </small>
                )}
              </div>
            </form>
          ) : selectedRun ? (
            <>
              <header className="thread-header">
                <h2>{selectedRun.displayTitle ?? selectedRun.name}</h2>
                <small>
                  {selectedRun.name} · {selectedRun.event} · {selectedRun.branch ?? "unknown branch"} ·{" "}
                  {selectedRun.actorLogin ? `started by ${selectedRun.actorLogin} · ` : ""}
                  {selectedRun.runStartedAt
                    ? `started ${formatRelativeDate(selectedRun.runStartedAt)}`
                    : formatRelativeDate(selectedRun.updatedAt)}
                </small>
              </header>
              <div className="workflow-summary">
                <span className={`state-chip ${selectedRun.conclusion === "success" ? "success" : ""}`}>
                  {selectedRun.conclusion ?? selectedRun.status ?? "queued"}
                </span>
                {selectedRun.runNumber !== null && <span>Run #{selectedRun.runNumber}</span>}
                {selectedRun.runAttempt !== null && <span>Attempt {selectedRun.runAttempt}</span>}
                {selectedRunSourceRepositoryNameWithOwner && (
                  <span>Source {selectedRunSourceRepositoryNameWithOwner}</span>
                )}
                <span>{selectedRun.commitSha?.slice(0, 7) ?? "No commit"}</span>
                {selectedRun.triggeringActorLogin && (
                  <span>Triggered by {selectedRun.triggeringActorLogin}</span>
                )}
                {detail && <span>{detail.jobs.length} jobs</span>}
                {detail && <span>{detail.checkRuns.length} checks</span>}
                {detail && <span>{detail.artifacts.length} artifacts</span>}
              </div>
              {runDetail.isLoading && <div className="loading-state">Loading run detail…</div>}
              {runDetail.error && (
                <div className="error-state">Run detail unavailable: {runDetail.error.message}</div>
              )}
              {workflowRunDetailAvailabilityMessage && (
                <div className="error-state">{workflowRunDetailAvailabilityMessage}</div>
              )}
              {workflowRunMutationActive && mutationPending && (
                <div className="loading-state">
                  {githubActionLabel(submittedWorkflowAction)} is running. Workflow run data is locked until
                  GitHub responds.
                </div>
              )}
              {workflowRunMutationActive && !mutationPending && mutationSucceeded && (
                <div className="success-state">
                  {githubActionLabel(submittedWorkflowAction)} completed. Workflow runs are refreshing.
                </div>
              )}
              {workflowRunMutationActive && !mutationPending && mutationError && (
                <div className="error-state">
                  {githubActionLabel(submittedWorkflowAction)} failed: {mutationError.message}
                </div>
              )}
              {detail && (
                <div className="workflow-detail-grid">
                  {failureSummary.length > 0 && (
                    <section className="workflow-failure-summary">
                      <header>
                        <h3>Failure summary</h3>
                        <span className="state-chip attention">{failureSummary.length} signals</span>
                      </header>
                      <div className="workflow-failure-list">
                        {failureSummary.map((item) => {
                          const failureControlDisabledReason =
                            item.jobId !== undefined || item.path
                              ? null
                              : "No in-app target returned for this failure signal.";

                          return (
                            <article className="workflow-failure-item" key={item.id}>
                              <div className="workflow-failure-copy">
                                <small>
                                  {item.kind} · {item.state}
                                </small>
                                <strong>{item.title}</strong>
                                <span>{item.detail}</span>
                              </div>
                              <div className="workflow-card-actions workflow-failure-actions">
                                <button
                                  type="button"
                                  disabled={Boolean(failureControlDisabledReason)}
                                  title={failureControlDisabledReason ?? undefined}
                                  onClick={() => {
                                    if (item.jobId !== undefined) {
                                      setSelectedLogJobSelection({
                                        runId: selectedRun.id,
                                        jobId: item.jobId
                                      });
                                    } else if (item.path) {
                                      onOpenCodePath(
                                        item.path,
                                        selectedRun.branch ??
                                          selectedRun.commitSha ??
                                          repository.defaultBranch ??
                                          null,
                                        item.url,
                                        item.line ?? null,
                                        selectedRunTargetRepositoryNameWithOwner
                                      );
                                    }
                                  }}
                                >
                                  Open in Control
                                </button>
                                <button
                                  type="button"
                                  disabled={!item.url}
                                  title={item.url ? undefined : "Failure signal URL unavailable."}
                                  onClick={() => {
                                    if (item.url) {
                                      onOpenExternal(item.url);
                                    }
                                  }}
                                >
                                  GitHub fallback
                                </button>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </section>
                  )}
                  {selectedRun.actionAvailability && (
                    <section>
                      <h3>Action availability</h3>
                      <div className="workflow-action-availability">
                        <span className="state-chip">
                          Rerun {workflowActionAvailabilityLabel(selectedRun.actionAvailability.canRerun)}
                        </span>
                        <span className="state-chip">
                          Failed jobs{" "}
                          {workflowActionAvailabilityLabel(selectedRun.actionAvailability.canRerunFailedJobs)}
                        </span>
                        <span className="state-chip">
                          Cancel {workflowActionAvailabilityLabel(selectedRun.actionAvailability.canCancel)}
                        </span>
                        {selectedRun.actionAvailability.previousAttemptUrl && (
                          <button
                            type="button"
                            onClick={() => {
                              if (selectedRun.actionAvailability?.previousAttemptUrl) {
                                onOpenExternal(selectedRun.actionAvailability.previousAttemptUrl);
                              }
                            }}
                          >
                            Previous attempt
                          </button>
                        )}
                      </div>
                    </section>
                  )}
                  <section>
                    <h3>Jobs</h3>
                    {workflowJobsAvailabilityMessage && (
                      <div className="error-state">{workflowJobsAvailabilityMessage}</div>
                    )}
                    {detail.jobs.map((job) => {
                      const jobRerunDisabledReason =
                        workflowActionPendingReason ??
                        liveWorkflowDisabledReason ??
                        workflowJobRerunDisabledReason(repository, job);
                      const jobLogsDisabledReason =
                        job.status === "queued" ? "Logs become available after the job starts." : null;

                      return (
                        <article className="workflow-job-card" key={job.id}>
                          <header>
                            <strong>{job.name}</strong>
                            <span className={`state-chip ${job.conclusion === "success" ? "success" : ""}`}>
                              {job.conclusion ?? job.status ?? "queued"}
                            </span>
                          </header>
                          <small>
                            {job.runnerName ?? "GitHub runner"} ·{" "}
                            {job.completedAt ? formatRelativeDate(job.completedAt) : "not completed"}
                          </small>
                          <div className="workflow-card-actions">
                            <button
                              type="button"
                              disabled={Boolean(jobRerunDisabledReason)}
                              title={jobRerunDisabledReason ?? undefined}
                              onClick={() =>
                                submitWorkflowMutation("rerunWorkflowJob", true, { jobId: job.id })
                              }
                            >
                              Rerun job
                            </button>
                            <button
                              type="button"
                              disabled={Boolean(jobLogsDisabledReason)}
                              title={jobLogsDisabledReason ?? undefined}
                              onClick={() =>
                                setSelectedLogJobSelection({ runId: selectedRun.id, jobId: job.id })
                              }
                            >
                              View logs
                            </button>
                            <button
                              type="button"
                              disabled={!job.htmlUrl}
                              title={job.htmlUrl ? undefined : "GitHub job URL unavailable."}
                              onClick={() => {
                                if (job.htmlUrl) {
                                  onOpenExternal(job.htmlUrl);
                                }
                              }}
                            >
                              GitHub job
                            </button>
                            {jobRerunDisabledReason && (
                              <small className="action-disabled-note">
                                Job rerun unavailable: {jobRerunDisabledReason}
                              </small>
                            )}
                          </div>
                          <div className="workflow-step-list">
                            {(expandedWorkflowDetailItems.jobStepIds.has(job.id)
                              ? job.steps
                              : job.steps.slice(0, workflowListLimit)
                            ).map((step) => (
                              <div key={`${job.id}-${step.number}`}>
                                <span>{step.name}</span>
                                <strong>{step.conclusion ?? step.status ?? "pending"}</strong>
                              </div>
                            ))}
                            {job.steps.length > workflowListLimit && (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedWorkflowDetailState((current) => {
                                    const currentItems =
                                      current.detailKey === workflowDetailKey
                                        ? current.items
                                        : initialExpandedWorkflowDetailItems;
                                    const jobStepIds = new Set(currentItems.jobStepIds);

                                    if (jobStepIds.has(job.id)) {
                                      jobStepIds.delete(job.id);
                                    } else {
                                      jobStepIds.add(job.id);
                                    }

                                    return {
                                      detailKey: workflowDetailKey,
                                      items: {
                                        ...currentItems,
                                        jobStepIds
                                      }
                                    };
                                  })
                                }
                              >
                                <small>
                                  {expandedWorkflowDetailItems.jobStepIds.has(job.id)
                                    ? "Show fewer"
                                    : `Show all ${job.steps.length} steps`}
                                </small>
                              </button>
                            )}
                          </div>
                        </article>
                      );
                    })}
                    {!runDetail.isLoading && !workflowJobsAvailabilityMessage && detail.jobs.length === 0 && (
                      <div className="empty-state">No jobs returned for this run.</div>
                    )}
                  </section>
                  <section>
                    <h3>Job log preview</h3>
                    {!selectedLogJob && <div className="empty-state">Select View logs on a job.</div>}
                    {selectedLogJob && (
                      <article className="workflow-job-card">
                        <header>
                          <strong>{selectedLogJob.name}</strong>
                          <span
                            className={`state-chip ${selectedLogJob.conclusion === "success" ? "success" : ""}`}
                          >
                            {selectedLogJob.conclusion ?? selectedLogJob.status ?? "queued"}
                          </span>
                        </header>
                        {jobLogs.isLoading && <div className="loading-state">Loading job logs…</div>}
                        {jobLogs.error && (
                          <div className="error-state">Job logs unavailable: {jobLogs.error.message}</div>
                        )}
                        {jobLogsAvailabilityMessage && (
                          <div className="error-state">{jobLogsAvailabilityMessage}</div>
                        )}
                        {jobLogs.data?.text && (
                          <pre className="workflow-log-preview">
                            <code>{jobLogs.data.text}</code>
                          </pre>
                        )}
                        {jobLogs.data?.truncated && (
                          <small className="action-disabled-note">
                            {jobLogPreviewCharacters >= largeJobLogPreviewCharacters
                              ? "Showing the first 50,000 characters. Download the full log for the complete output."
                              : "Log preview truncated by Control."}
                          </small>
                        )}
                        {jobLogs.data?.availability.status === "available" && !jobLogs.data.text && (
                          <div className="empty-state">GitHub returned an empty log.</div>
                        )}
                        {jobLogs.data && (
                          <div className="workflow-card-actions">
                            {jobLogs.data.truncated &&
                              jobLogPreviewCharacters < largeJobLogPreviewCharacters && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (selectedLogJobKey) {
                                      setJobLogPreviewSizeSelection({
                                        key: selectedLogJobKey,
                                        maxCharacters: largeJobLogPreviewCharacters
                                      });
                                    }
                                  }}
                                >
                                  Load larger preview
                                </button>
                              )}
                            <button
                              type="button"
                              disabled={!jobLogs.data.downloadUrl}
                              title={
                                jobLogs.data.downloadUrl
                                  ? undefined
                                  : (jobLogsAvailabilityMessage ?? "Full job log download URL unavailable.")
                              }
                              onClick={() => {
                                if (jobLogs.data?.downloadUrl) {
                                  onOpenExternal(jobLogs.data.downloadUrl);
                                }
                              }}
                            >
                              <ExternalLink size={15} /> Download full log
                            </button>
                          </div>
                        )}
                      </article>
                    )}
                  </section>
                  <section>
                    <h3>Artifacts</h3>
                    {workflowArtifactsAvailabilityMessage && (
                      <div className="error-state">{workflowArtifactsAvailabilityMessage}</div>
                    )}
                    {selectedWorkflowArtifact && (
                      <div className="workflow-summary release-asset-summary">
                        <span>Artifact id {selectedWorkflowArtifact.id}</span>
                        <span>{formatCompactNumber(selectedWorkflowArtifact.sizeInBytes)} bytes</span>
                        <span>{selectedWorkflowArtifact.expired ? "Expired" : "Available"}</span>
                        <span>
                          {selectedWorkflowArtifact.expiresAt
                            ? `Expires ${formatRelativeDate(selectedWorkflowArtifact.expiresAt)}`
                            : "No expiration returned"}
                        </span>
                        <span>
                          {selectedWorkflowArtifact.updatedAt
                            ? `Updated ${formatRelativeDate(selectedWorkflowArtifact.updatedAt)}`
                            : "Update time unknown"}
                        </span>
                      </div>
                    )}
                    <article className="workflow-artifact-row">
                      <div>
                        <strong>Workflow logs</strong>
                        <small>
                          {detail.logs.available
                            ? "Temporary download ready"
                            : (readAvailabilityMessage("Workflow logs", detail.logs.availability) ??
                              detail.logs.message ??
                              "Logs unavailable")}
                        </small>
                      </div>
                      <button
                        type="button"
                        disabled={!detail.logs.downloadUrl}
                        title={
                          detail.logs.downloadUrl
                            ? undefined
                            : (readAvailabilityMessage("Workflow logs", detail.logs.availability) ??
                              detail.logs.message ??
                              "Logs unavailable")
                        }
                        onClick={() => {
                          if (detail.logs.downloadUrl) {
                            onOpenExternal(detail.logs.downloadUrl);
                          }
                        }}
                      >
                        Download logs
                      </button>
                    </article>
                    {detail.artifacts.map((artifact) => {
                      const artifactDisabledReason = artifact.expired
                        ? "Artifact expired."
                        : artifact.archiveDownloadUrl
                          ? null
                          : (readAvailabilityMessage(
                              "Artifact archive download",
                              artifact.archiveDownloadAvailability
                            ) ?? "Artifact download URL unavailable.");
                      const artifactDateLabels = [
                        artifact.expiresAt ? `expires ${formatRelativeDate(artifact.expiresAt)}` : null,
                        artifact.updatedAt ? `updated ${formatRelativeDate(artifact.updatedAt)}` : null,
                        artifact.createdAt ? `created ${formatRelativeDate(artifact.createdAt)}` : null
                      ].filter((label): label is string => Boolean(label));

                      return (
                        <article
                          className={`workflow-artifact-row ${
                            selectedWorkflowArtifact?.id === artifact.id ? "active" : ""
                          }`}
                          key={artifact.id}
                        >
                          <div>
                            <strong>{artifact.name}</strong>
                            <small>
                              {formatCompactNumber(artifact.sizeInBytes)} bytes ·{" "}
                              {artifact.expired ? "expired" : "available"}
                              {artifactDateLabels.length > 0 ? ` · ${artifactDateLabels.join(" · ")}` : ""}
                            </small>
                          </div>
                          <span className="state-chip">{artifact.expired ? "expired" : "available"}</span>
                          <button
                            type="button"
                            onClick={() => onSelectWorkflowArtifact(selectedRun, artifact)}
                          >
                            <Download size={15} /> Inspect
                          </button>
                          <button
                            type="button"
                            disabled={Boolean(artifactDisabledReason)}
                            title={artifactDisabledReason ?? undefined}
                            onClick={() => {
                              if (artifact.archiveDownloadUrl) {
                                onOpenExternal(artifact.archiveDownloadUrl);
                              }
                            }}
                          >
                            <ExternalLink size={15} /> Download
                          </button>
                        </article>
                      );
                    })}
                    {!runDetail.isLoading &&
                      !workflowArtifactsAvailabilityMessage &&
                      detail.artifacts.length === 0 && (
                        <div className="empty-state">No artifacts returned for this run.</div>
                      )}
                  </section>
                  <section>
                    <h3>Checks</h3>
                    {workflowCheckRunsAvailabilityMessage && (
                      <div className="error-state">{workflowCheckRunsAvailabilityMessage}</div>
                    )}
                    {detail.checkRuns.map((checkRun) => (
                      <article className="workflow-job-card" key={checkRun.id}>
                        <header>
                          <strong>{checkRun.name}</strong>
                          <span
                            className={`state-chip ${checkRun.conclusion === "success" ? "success" : ""}`}
                          >
                            {checkRun.conclusion ?? checkRun.status ?? "queued"}
                          </span>
                        </header>
                        <small>
                          {checkRun.appName ?? "GitHub Checks"} ·{" "}
                          {checkRun.completedAt ? formatRelativeDate(checkRun.completedAt) : "not completed"}
                        </small>
                        {(checkRun.outputTitle || checkRun.outputSummary) && (
                          <p className="workflow-check-output">
                            {checkRun.outputTitle && <strong>{checkRun.outputTitle}</strong>}
                            {checkRun.outputSummary && <span>{checkRun.outputSummary}</span>}
                          </p>
                        )}
                        <div className="workflow-card-actions">
                          <button
                            type="button"
                            disabled={!checkRun.detailsUrl && !checkRun.htmlUrl}
                            title={
                              checkRun.detailsUrl || checkRun.htmlUrl
                                ? undefined
                                : "Check details URL unavailable."
                            }
                            onClick={() => {
                              const checkUrl = checkRun.detailsUrl ?? checkRun.htmlUrl;

                              if (checkUrl) {
                                onOpenExternal(checkUrl);
                              }
                            }}
                          >
                            Check details
                          </button>
                          <button
                            type="button"
                            disabled={!checkRun.appHtmlUrl}
                            title={checkRun.appHtmlUrl ? undefined : "Check app URL unavailable."}
                            onClick={() => {
                              if (checkRun.appHtmlUrl) {
                                onOpenExternal(checkRun.appHtmlUrl);
                              }
                            }}
                          >
                            Check app
                          </button>
                        </div>
                        {readAvailabilityMessage("Check annotations", checkRun.annotationsAvailability) && (
                          <div className="error-state">
                            {readAvailabilityMessage("Check annotations", checkRun.annotationsAvailability)}
                          </div>
                        )}
                        {checkRun.annotations.length > 0 && (
                          <div className="workflow-annotation-list">
                            {(expandedWorkflowDetailItems.checkAnnotationIds.has(checkRun.id)
                              ? checkRun.annotations
                              : checkRun.annotations.slice(0, workflowListLimit)
                            ).map((annotation) => (
                              <div
                                className="workflow-annotation-row"
                                key={`${checkRun.id}-${annotation.path}-${annotation.startLine ?? "line"}-${annotation.endLine ?? "end"}-${annotation.annotationLevel ?? "level"}-${annotation.message}`}
                              >
                                <div>
                                  <strong>{annotation.title ?? annotation.message}</strong>
                                  <small>
                                    {annotation.path}
                                    {annotation.startLine ? `:${annotation.startLine}` : ""}
                                    {annotation.endLine && annotation.endLine !== annotation.startLine
                                      ? `-${annotation.endLine}`
                                      : ""}
                                  </small>
                                  {annotation.rawDetails && <small>{annotation.rawDetails}</small>}
                                  {!annotation.rawDetails && annotation.title && (
                                    <small>{annotation.message}</small>
                                  )}
                                </div>
                                <span className="state-chip">
                                  {annotation.annotationLevel ?? "annotation"}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onOpenCodePath(
                                      annotation.path,
                                      selectedRun.branch ??
                                        selectedRun.commitSha ??
                                        repository.defaultBranch ??
                                        null,
                                      annotation.blobHref,
                                      annotation.startLine ?? null,
                                      selectedRunTargetRepositoryNameWithOwner
                                    )
                                  }
                                >
                                  Open in Control
                                </button>
                                <button
                                  type="button"
                                  disabled={!annotation.blobHref}
                                  title={annotation.blobHref ? undefined : "Annotation file URL unavailable."}
                                  onClick={() => {
                                    if (annotation.blobHref) {
                                      onOpenExternal(annotation.blobHref);
                                    }
                                  }}
                                >
                                  GitHub fallback
                                </button>
                              </div>
                            ))}
                            {checkRun.annotations.length > workflowListLimit && (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedWorkflowDetailState((current) => {
                                    const currentItems =
                                      current.detailKey === workflowDetailKey
                                        ? current.items
                                        : initialExpandedWorkflowDetailItems;
                                    const checkAnnotationIds = new Set(currentItems.checkAnnotationIds);

                                    if (checkAnnotationIds.has(checkRun.id)) {
                                      checkAnnotationIds.delete(checkRun.id);
                                    } else {
                                      checkAnnotationIds.add(checkRun.id);
                                    }

                                    return {
                                      detailKey: workflowDetailKey,
                                      items: {
                                        ...currentItems,
                                        checkAnnotationIds
                                      }
                                    };
                                  })
                                }
                              >
                                <small>
                                  {expandedWorkflowDetailItems.checkAnnotationIds.has(checkRun.id)
                                    ? "Show fewer"
                                    : `Show all ${checkRun.annotations.length} annotations`}
                                </small>
                              </button>
                            )}
                          </div>
                        )}
                      </article>
                    ))}
                    {!runDetail.isLoading &&
                      !workflowCheckRunsAvailabilityMessage &&
                      detail.checkRuns.length === 0 && (
                        <div className="empty-state">No check runs returned for this commit.</div>
                      )}
                    {workflowCheckSuitesAvailabilityMessage && (
                      <div className="error-state">{workflowCheckSuitesAvailabilityMessage}</div>
                    )}
                    {detail.checkSuites.length > 0 && (
                      <div className="workflow-annotation-list">
                        {detail.checkSuites.map((suite) => (
                          <article className="workflow-annotation-row" key={suite.id}>
                            <div>
                              <strong>{suite.appName ?? "GitHub check suite"}</strong>
                              <small>
                                {suite.latestCheckRunCount !== null
                                  ? `${suite.latestCheckRunCount} latest checks`
                                  : "Check count unavailable"}
                                {suite.headBranch ? ` · ${suite.headBranch}` : ""}
                                {suite.headSha ? ` · ${suite.headSha.slice(0, 7)}` : ""}
                              </small>
                              <small>
                                {suite.updatedAt
                                  ? `Updated ${formatRelativeDate(suite.updatedAt)}`
                                  : "No update time"}
                              </small>
                            </div>
                            <span className={`state-chip ${suite.conclusion === "success" ? "success" : ""}`}>
                              {suite.conclusion ?? suite.status ?? "queued"}
                            </span>
                            <button
                              type="button"
                              disabled={!suite.headSha}
                              title={suite.headSha ? undefined : "Check suite head SHA unavailable."}
                              onClick={() => {
                                if (suite.headSha) {
                                  onOpenWorkflowCheckSuiteCommit(
                                    suite,
                                    selectedRunTargetRepositoryNameWithOwner
                                  );
                                }
                              }}
                            >
                              Open suite commit
                            </button>
                            <button
                              type="button"
                              disabled={!suite.appHtmlUrl}
                              title={suite.appHtmlUrl ? undefined : "Check suite app URL unavailable."}
                              onClick={() => {
                                if (suite.appHtmlUrl) {
                                  onOpenExternal(suite.appHtmlUrl);
                                }
                              }}
                            >
                              Open app
                            </button>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              )}
              <div className="thread-actions">
                <button
                  type="button"
                  disabled={!selectedRun.commitSha}
                  title={selectedRun.commitSha ? undefined : "Workflow run commit SHA unavailable."}
                  onClick={() => {
                    if (selectedRun.commitSha) {
                      onOpenWorkflowRunCommit(selectedRun, selectedRunTargetRepositoryNameWithOwner);
                    }
                  }}
                >
                  Open commit in Control
                </button>
                <button type="button" onClick={() => onOpenExternal(selectedRun.htmlUrl)}>
                  <ExternalLink size={16} /> GitHub fallback
                </button>
                <button
                  type="button"
                  disabled={Boolean(selectedRerunDisabledReason)}
                  title={selectedRerunDisabledReason ?? undefined}
                  onClick={() => submitWorkflowMutation("rerunWorkflow", true, { runId: selectedRun.id })}
                >
                  Rerun
                </button>
                <button
                  type="button"
                  disabled={Boolean(selectedFailedJobsRerunDisabledReason)}
                  title={selectedFailedJobsRerunDisabledReason ?? undefined}
                  onClick={() =>
                    submitWorkflowMutation("rerunFailedWorkflowJobs", true, { runId: selectedRun.id })
                  }
                >
                  Rerun failed jobs
                </button>
                <button
                  type="button"
                  disabled={Boolean(selectedCancelDisabledReason)}
                  title={selectedCancelDisabledReason ?? undefined}
                  onClick={() => submitWorkflowMutation("cancelWorkflow", true, { runId: selectedRun.id })}
                >
                  Cancel run
                </button>
                {selectedRerunDisabledReason && (
                  <small className="action-disabled-note">
                    Rerun unavailable: {selectedRerunDisabledReason}
                  </small>
                )}
                {selectedFailedJobsRerunDisabledReason && (
                  <small className="action-disabled-note">
                    Failed-job rerun unavailable: {selectedFailedJobsRerunDisabledReason}
                  </small>
                )}
                {selectedCancelDisabledReason && (
                  <small className="action-disabled-note">
                    Cancel unavailable: {selectedCancelDisabledReason}
                  </small>
                )}
              </div>
            </>
          ) : (
            <div className="empty-state">No workflow runs found.</div>
          )}
        </div>
      </div>
    </section>
  );
}
