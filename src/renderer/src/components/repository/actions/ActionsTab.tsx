import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Clock3,
  Download,
  ExternalLink,
  GitBranch,
  Home,
  ListFilter,
  Search,
  Workflow,
  XCircle
} from "lucide-react";
import { useState, type FormEvent, type JSX } from "react";
import { useQuery } from "@tanstack/react-query";

import type {
  GitHubAction,
  GitHubMutationFields,
  RepositoryDetail,
  WorkflowDefinitionSummary,
  WorkflowDispatchInputSummary,
  WorkflowJobLogsResult,
  WorkflowRunArtifactSummary,
  WorkflowRunCheckAnnotationSummary,
  WorkflowRunCheckRunSummary,
  WorkflowRunCheckSuiteSummary,
  WorkflowRunDetail,
  WorkflowRunDetailResult,
  WorkflowRunJobSummary,
  WorkflowRunStepSummary,
  WorkflowRunSummary
} from "@shared/github";

import {
  fieldsMatchSearchParts,
  githubActionLabel,
  normalizedSearchParts,
  readAvailabilityMessage,
  repositoryMutationDisabledReason
} from "@renderer/components/repository/repositoryUi";
import { isWorkflowRunAttention } from "@renderer/components/repository/workflows/workflowRunState";
import { useControlApi } from "@renderer/hooks/useControlApi";
import { useRepositoryRefs } from "@renderer/hooks/useRepositoryRefs";

import { formatCompactNumber, formatRelativeDate } from "@renderer/utils/format";
import { useActionsTabQueries, workflowRunDetailQueryKey } from "./ActionsTab.queries";

const maxActionsLimit = 100;
const maxWorkflowDefinitionLimit = 100;
const workflowRunStatusSuccessStates = new Set(["success", "completed"]);
const workflowRunStatusAttentionStates = new Set([
  "failure",
  "cancelled",
  "timed_out",
  "startup_failure",
  "action_required"
]);

function workflowStateText(value: string | null | undefined): string {
  return value?.replace(/_/g, " ") ?? "queued";
}

function workflowStateClass(value: string | null | undefined): string {
  if (value && workflowRunStatusSuccessStates.has(value)) {
    return "success";
  }
  if (value && workflowRunStatusAttentionStates.has(value)) {
    return "attention";
  }
  return "";
}

function WorkflowStateIcon({ state }: { state: string | null | undefined }): JSX.Element {
  if (state && workflowRunStatusSuccessStates.has(state)) {
    return <CheckCircle2 className="workflow-state-icon success" size={18} />;
  }
  if (state && workflowRunStatusAttentionStates.has(state)) {
    return <XCircle className="workflow-state-icon attention" size={18} />;
  }
  return <CircleDot className="workflow-state-icon" size={18} />;
}

function workflowRunState(run: Pick<WorkflowRunSummary, "conclusion" | "status">): string | null {
  return run.conclusion ?? run.status ?? "queued";
}

function workflowEventLabel(value: string | null | undefined): string {
  if (!value) {
    return "Unknown event";
  }
  return value
    .split("_")
    .map((part) => (part ? `${part[0]?.toUpperCase()}${part.slice(1)}` : part))
    .join(" ");
}

function formatWorkflowDuration(start: string | null | undefined, end: string | null | undefined): string {
  if (!start || !end) {
    return "Duration unavailable";
  }
  const startTime = Date.parse(start);
  const endTime = Date.parse(end);
  if (Number.isNaN(startTime) || Number.isNaN(endTime) || endTime < startTime) {
    return "Duration unavailable";
  }
  const totalSeconds = Math.max(1, Math.round((endTime - startTime) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [
    hours > 0 ? `${hours}h` : null,
    minutes > 0 ? `${minutes}m` : null,
    seconds > 0 || (hours === 0 && minutes === 0) ? `${seconds}s` : null
  ].filter((part): part is string => Boolean(part));
  return parts.join(" ");
}

const workflowLogTimestampPattern = /^(\d{4}-\d{2}-\d{2}T\S+Z)\s?(.*)$/;

function workflowLogLineTimestamp(line: string): number | null {
  const match = workflowLogTimestampPattern.exec(line);
  if (!match) {
    return null;
  }
  const timestamp = Date.parse(match[1]);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function workflowStepTimestamp(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function workflowLogSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function workflowStepLogText(
  logText: string,
  selectedStep: WorkflowRunStepSummary,
  steps: WorkflowRunStepSummary[]
): { text: string; matched: boolean } {
  const lines = logText.split(/\r?\n/);
  const stepStart = workflowStepTimestamp(selectedStep.startedAt);
  const nextStepStart =
    steps
      .filter((step) => step.number > selectedStep.number)
      .map((step) => workflowStepTimestamp(step.startedAt))
      .filter((timestamp): timestamp is number => timestamp !== null)
      .sort((left, right) => left - right)[0] ?? null;

  if (stepStart !== null) {
    const stepEnd =
      workflowStepTimestamp(selectedStep.completedAt) ?? nextStepStart ?? Number.POSITIVE_INFINITY;
    const selectedLines = lines.filter((line) => {
      const timestamp = workflowLogLineTimestamp(line);
      return timestamp !== null && timestamp >= stepStart - 1000 && timestamp <= stepEnd + 1000;
    });

    if (selectedLines.length > 0) {
      return { text: selectedLines.join("\n"), matched: true };
    }
  }

  const stepName = workflowLogSearchText(selectedStep.name);
  if (!stepName) {
    return { text: "", matched: false };
  }

  const startIndex = lines.findIndex((line) => workflowLogSearchText(line).includes(stepName));
  if (startIndex === -1) {
    return { text: "", matched: false };
  }

  const laterStepNames = steps
    .filter((step) => step.number > selectedStep.number)
    .map((step) => workflowLogSearchText(step.name))
    .filter(Boolean);
  const endIndex = lines.findIndex((line, index) => {
    if (index <= startIndex) {
      return false;
    }
    const lineText = workflowLogSearchText(line);
    return laterStepNames.some((name) => lineText.includes(name));
  });

  return {
    text: lines.slice(startIndex, endIndex === -1 ? undefined : endIndex).join("\n"),
    matched: true
  };
}

function workflowLogDisplay(
  logText: string,
  selectedStep: WorkflowRunStepSummary | null,
  steps: WorkflowRunStepSummary[]
): { text: string; message: string | null } {
  if (!selectedStep) {
    return { text: logText, message: null };
  }

  const stepLog = workflowStepLogText(logText, selectedStep, steps);
  if (stepLog.matched && stepLog.text.trim()) {
    return { text: stepLog.text, message: null };
  }

  return {
    text: logText,
    message: `Control could not isolate ${selectedStep.name} in the loaded log text, so the full loaded job log is shown.`
  };
}

function workflowIdentity(workflow: WorkflowDefinitionSummary): string {
  return workflow.path || String(workflow.id);
}

function workflowMatchesIdentity(workflow: WorkflowDefinitionSummary, workflowId: string | null): boolean {
  return Boolean(
    workflowId &&
    (workflow.path === workflowId || workflow.name === workflowId || String(workflow.id) === workflowId)
  );
}

function workflowMatchesRun(workflow: WorkflowDefinitionSummary, run: WorkflowRunSummary): boolean {
  return workflow.name.toLowerCase() === run.name.toLowerCase();
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

type ExpandedWorkflowDetailItems = {
  jobStepIds: Set<number>;
  checkAnnotationIds: Set<number>;
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
  workflowRef: string,
  values: WorkflowDispatchInputValues
): string | null {
  if (!workflowId.trim()) {
    return "Workflow dispatch requires a workflow file, name, or id.";
  }
  if (!workflowRef.trim()) {
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

function WorkflowRunFilterBar({
  filter,
  runWorkflowDisabledReason,
  onFilterChange,
  onStartDispatch
}: {
  filter: string;
  runWorkflowDisabledReason: string | null;
  onFilterChange(value: string): void;
  onStartDispatch(): void;
}): JSX.Element {
  return (
    <div className="table-action-row surface-filter-row">
      <label className="surface-filter">
        <Search size={15} />
        <input
          aria-label="Filter workflow runs"
          value={filter}
          onChange={(event) => onFilterChange(event.target.value)}
          placeholder="Filter workflow runs"
        />
      </label>
      <button
        type="button"
        disabled={Boolean(runWorkflowDisabledReason)}
        title={runWorkflowDisabledReason ?? undefined}
        onClick={onStartDispatch}
      >
        <Workflow size={16} /> Run workflow
      </button>
    </div>
  );
}

function WorkflowCatalogPane({
  workflows,
  actions,
  selectedWorkflowId,
  workflowsLoading,
  workflowsFetching,
  workflowsError,
  workflowDefinitionsAvailabilityMessage,
  workflowDefinitionsLimitHit,
  canExpandWorkflowDefinitions,
  workflowDefinitionLimit,
  onSelectWorkflow,
  onExpandWorkflowDefinitions
}: {
  workflows: WorkflowDefinitionSummary[];
  actions: WorkflowRunSummary[];
  selectedWorkflowId: string | null;
  workflowsLoading: boolean;
  workflowsFetching: boolean;
  workflowsError: Error | null;
  workflowDefinitionsAvailabilityMessage: string | null;
  workflowDefinitionsLimitHit: boolean;
  canExpandWorkflowDefinitions: boolean;
  workflowDefinitionLimit: number;
  onSelectWorkflow(workflowId: string | null): void;
  onExpandWorkflowDefinitions(): void;
}): JSX.Element {
  const selectedAllRuns = selectedWorkflowId === null;

  return (
    <section className="workflow-catalog actions-sidebar" aria-label="Workflow catalog">
      <header className="actions-sidebar-header">
        <strong>Actions</strong>
        <span className="state-chip">{workflows.length} definitions</span>
      </header>
      {workflowsLoading && workflows.length === 0 && <div className="loading-state">Loading workflows…</div>}
      {workflowsError && (
        <div className="error-state">Workflow definitions unavailable: {workflowsError.message}</div>
      )}
      {workflowDefinitionsAvailabilityMessage && (
        <div className="error-state">{workflowDefinitionsAvailabilityMessage}</div>
      )}
      <button
        type="button"
        className={`workflow-catalog-row ${selectedAllRuns ? "active" : ""}`}
        onClick={() => onSelectWorkflow(null)}
      >
        <div>
          <strong>All workflows</strong>
          <small>Repository workflow activity across every workflow.</small>
        </div>
        <span className="state-chip">{actions.length} runs</span>
      </button>
      {workflows.map((workflow) => {
        const workflowRuns = actions.filter((run) => workflowMatchesRun(workflow, run));
        const latestRun = workflowRuns[0] ?? null;
        const selected = workflowMatchesIdentity(workflow, selectedWorkflowId);

        return (
          <article key={workflow.id} className={`workflow-catalog-row ${selected ? "active" : ""}`}>
            <button type="button" onClick={() => onSelectWorkflow(workflowIdentity(workflow))}>
              <div>
                <strong>{workflow.name}</strong>
                <small>
                  {workflow.path} · {workflow.state}
                  {latestRun
                    ? ` · latest ${latestRun.conclusion ?? latestRun.status ?? "queued"} ${formatRelativeDate(
                        latestRun.updatedAt
                      )}`
                    : " · no run in current list"}
                </small>
              </div>
              <span className={`state-chip ${workflow.dispatchable ? "success" : ""}`}>
                {workflow.dispatchable ? "dispatchable" : workflow.state}
              </span>
            </button>
          </article>
        );
      })}
      {!workflowsLoading && !workflowDefinitionsAvailabilityMessage && workflows.length === 0 && (
        <div className="empty-state">No workflow definitions returned for this repository.</div>
      )}
      {canExpandWorkflowDefinitions && (
        <div className="table-action-row">
          <button type="button" disabled={workflowsFetching} onClick={onExpandWorkflowDefinitions}>
            <ChevronDown size={16} /> {workflowsFetching ? "Loading workflows…" : "Load more workflows"}
          </button>
        </div>
      )}
      {!canExpandWorkflowDefinitions && workflowDefinitionsLimitHit && (
        <div className="muted-row">
          Showing the first {workflows.length || workflowDefinitionLimit} workflow definitions returned by
          GitHub.
        </div>
      )}
    </section>
  );
}

function WorkflowRunList({
  repository,
  actions,
  filteredActions,
  selectedRunId,
  dispatching,
  loading,
  error,
  actionsAvailabilityMessage,
  filter,
  canExpandActions,
  actionsLimitHit,
  onSelectRun,
  onExpandActions
}: {
  repository: RepositoryDetail;
  actions: WorkflowRunSummary[];
  filteredActions: WorkflowRunSummary[];
  selectedRunId: number | null;
  dispatching: boolean;
  loading: boolean;
  error: Error | null;
  actionsAvailabilityMessage: string | null;
  filter: string;
  canExpandActions: boolean;
  actionsLimitHit: boolean;
  onSelectRun(run: WorkflowRunSummary): void;
  onExpandActions(): void;
}): JSX.Element {
  return (
    <div className="actions-run-table">
      {loading && actions.length === 0 && <div className="loading-state">Loading workflow runs…</div>}
      {error && <div className="error-state">Workflow runs unavailable: {error.message}</div>}
      {actionsAvailabilityMessage && <div className="error-state">{actionsAvailabilityMessage}</div>}
      <header className="actions-run-table-header">
        <strong>{filteredActions.length} workflow runs</strong>
        <div className="actions-run-table-columns" aria-hidden="true">
          <span />
          <span>Workflow</span>
          <span>Event</span>
          <span>Status</span>
          <span>Branch</span>
          <span />
          <span />
        </div>
      </header>
      {filteredActions.map((run) => {
        const sourceRepositoryNameWithOwner =
          run.headRepositoryNameWithOwner && run.headRepositoryNameWithOwner !== repository.nameWithOwner
            ? run.headRepositoryNameWithOwner
            : null;
        const state = workflowRunState(run);
        const runDuration = formatWorkflowDuration(run.runStartedAt ?? run.createdAt, run.updatedAt);
        const workflowRunMetadata = [
          run.name,
          run.runNumber ? `#${run.runNumber}` : null,
          run.commitSha ? run.commitSha.slice(0, 7) : null,
          sourceRepositoryNameWithOwner ? `Source ${sourceRepositoryNameWithOwner}` : null,
          run.triggeringActorLogin && run.triggeringActorLogin !== run.actorLogin
            ? `triggered by ${run.triggeringActorLogin}`
            : null,
          run.runAttempt && run.runAttempt > 1 ? `attempt ${run.runAttempt}` : null
        ].filter(Boolean);

        return (
          <article
            className={`actions-run-row ${selectedRunId === run.id && !dispatching ? "active" : ""}`}
            key={run.id}
          >
            <button className="actions-run-row-main" type="button" onClick={() => onSelectRun(run)}>
              <WorkflowStateIcon state={state} />
              <div className="workflow-run-copy">
                <strong>{run.displayTitle ?? run.name}</strong>
                <small>{workflowRunMetadata.join(" · ")}</small>
              </div>
              <span className="actions-run-event">{workflowEventLabel(run.event)}</span>
              <span className={`state-chip ${workflowStateClass(state)}`}>{workflowStateText(state)}</span>
              <span className="actions-run-branch">
                <GitBranch size={14} />
                {run.branch ?? "unknown"}
              </span>
              <span className="actions-run-time">
                {run.runStartedAt ? formatRelativeDate(run.runStartedAt) : formatRelativeDate(run.updatedAt)}
              </span>
              <span className="actions-run-duration">
                <Clock3 size={14} />
                {runDuration}
              </span>
            </button>
          </article>
        );
      })}
      {!loading && !actionsAvailabilityMessage && filteredActions.length === 0 && (
        <div className="empty-state">
          {filter.trim()
            ? "No workflow runs match this filter."
            : "No workflow runs returned for this repository."}
        </div>
      )}
      {canExpandActions && (
        <div className="table-action-row">
          <button type="button" onClick={onExpandActions}>
            <ChevronDown size={16} /> Load more runs
          </button>
        </div>
      )}
      {!canExpandActions && actionsLimitHit && (
        <div className="muted-row">Showing the first {actions.length} workflow runs returned by GitHub.</div>
      )}
    </div>
  );
}

function WorkflowDispatchForm({
  repository,
  workflowItems,
  workflowsLoading,
  workflowsFetching,
  workflowsError,
  workflowDefinitionsAvailabilityMessage,
  workflowDefinitionsEmpty,
  workflowDefinitionsLimitHit,
  canExpandWorkflowDefinitions,
  effectiveWorkflowId,
  selectedWorkflow,
  workflowInputValues,
  workflowId,
  workflowRef,
  workflowRefOptions,
  refsError,
  refsAvailabilityMessage,
  dispatchConfigurationDisabled,
  repositoryDispatchDisabledReason,
  dispatchDisabledReason,
  manualWorkflowInputMetadataUnavailable,
  dispatchMutationActive,
  mutationPending,
  mutationSucceeded,
  mutationError,
  workflowDefinitionLimit,
  onWorkflowIdChange,
  onRefChange,
  onWorkflowInputChange,
  onSubmitDispatch,
  onCancelDispatch,
  onExpandWorkflowDefinitions
}: {
  repository: RepositoryDetail;
  workflowItems: WorkflowDefinitionSummary[];
  workflowsLoading: boolean;
  workflowsFetching: boolean;
  workflowsError: Error | null;
  workflowDefinitionsAvailabilityMessage: string | null;
  workflowDefinitionsEmpty: boolean;
  workflowDefinitionsLimitHit: boolean;
  canExpandWorkflowDefinitions: boolean;
  effectiveWorkflowId: string;
  selectedWorkflow: WorkflowDefinitionSummary | null;
  workflowInputValues: WorkflowDispatchInputValues;
  workflowId: string;
  workflowRef: string;
  workflowRefOptions: Array<{ label: string; group: string }>;
  refsError: Error | null;
  refsAvailabilityMessage: string | null;
  dispatchConfigurationDisabled: boolean;
  repositoryDispatchDisabledReason: string | null;
  dispatchDisabledReason: string | null;
  manualWorkflowInputMetadataUnavailable: boolean;
  dispatchMutationActive: boolean;
  mutationPending: boolean;
  mutationSucceeded: boolean;
  mutationError: Error | null;
  workflowDefinitionLimit: number;
  onWorkflowIdChange(value: string): void;
  onRefChange(value: string): void;
  onWorkflowInputChange(name: string, value: string | boolean): void;
  onSubmitDispatch(): void;
  onCancelDispatch(): void;
  onExpandWorkflowDefinitions(): void;
}): JSX.Element {
  function submitDispatch(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    onSubmitDispatch();
  }

  return (
    <form className="compose-form" onSubmit={submitDispatch}>
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
      {workflowsLoading && <div className="loading-state">Loading workflows…</div>}
      {workflowsError && (
        <div className="error-state">Workflow definitions unavailable: {workflowsError.message}</div>
      )}
      {workflowDefinitionsAvailabilityMessage && (
        <div className="error-state">{workflowDefinitionsAvailabilityMessage}</div>
      )}
      {!workflowsError && workflowDefinitionsEmpty && (
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
          onChange={(event) => onWorkflowIdChange(event.target.value)}
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
          onChange={(event) => onWorkflowIdChange(event.target.value)}
          placeholder="workflow file, name, or id"
        />
      )}
      {canExpandWorkflowDefinitions && (
        <div className="table-action-row">
          <button type="button" disabled={workflowsFetching} onClick={onExpandWorkflowDefinitions}>
            <ChevronDown size={16} /> {workflowsFetching ? "Loading workflows…" : "Load more workflows"}
          </button>
        </div>
      )}
      {!canExpandWorkflowDefinitions && workflowDefinitionsLimitHit && (
        <small className="action-disabled-note">
          Showing the first {workflowItems.length || workflowDefinitionLimit} workflow definitions returned by
          GitHub.
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
        value={workflowRef}
        list={`workflow-dispatch-refs-${repository.id}`}
        onChange={(event) => onRefChange(event.target.value)}
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
      {refsAvailabilityMessage && <small className="action-disabled-note">{refsAvailabilityMessage}</small>}
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
                  onChange={(event) => onWorkflowInputChange(input.name, event.target.checked)}
                />
              ) : input.type === "choice" && input.options.length > 0 ? (
                <select
                  aria-label={input.name}
                  disabled={dispatchConfigurationDisabled}
                  title={repositoryDispatchDisabledReason ?? undefined}
                  value={String(workflowInputValues[input.name] ?? "")}
                  onChange={(event) => onWorkflowInputChange(input.name, event.target.value)}
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
                  onChange={(event) => onWorkflowInputChange(input.name, event.target.value)}
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
        <button type="button" onClick={onCancelDispatch}>
          Cancel
        </button>
        {dispatchDisabledReason && (
          <small className="action-disabled-note">Dispatch unavailable: {dispatchDisabledReason}</small>
        )}
      </div>
    </form>
  );
}

function WorkflowRunMutationStatus({
  active,
  pending,
  succeeded,
  error,
  action
}: {
  active: boolean;
  pending: boolean;
  succeeded: boolean;
  error: Error | null;
  action: GitHubAction | null;
}): JSX.Element | null {
  if (!active || !action) {
    return null;
  }
  if (pending) {
    return (
      <div className="loading-state">
        {githubActionLabel(action)} is running. Workflow run data is locked until GitHub responds.
      </div>
    );
  }
  if (succeeded) {
    return (
      <div className="success-state">
        {githubActionLabel(action)} completed. Workflow runs are refreshing.
      </div>
    );
  }
  return error ? (
    <div className="error-state">
      {githubActionLabel(action)} failed: {error.message}
    </div>
  ) : null;
}

function WorkflowFailureSummaryCard({
  item,
  onOpenInControl
}: {
  item: WorkflowFailureSummaryItem;
  onOpenInControl(item: WorkflowFailureSummaryItem): void;
}): JSX.Element {
  const disabledReason =
    item.jobId !== undefined || item.path ? null : "No in-app target returned for this failure signal.";

  return (
    <article className="workflow-failure-item">
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
          disabled={Boolean(disabledReason)}
          title={disabledReason ?? undefined}
          onClick={() => onOpenInControl(item)}
        >
          Open in Control
        </button>
      </div>
    </article>
  );
}

function WorkflowFailureSummarySection({
  failureSummary,
  onOpenInControl
}: {
  failureSummary: WorkflowFailureSummaryItem[];
  onOpenInControl(item: WorkflowFailureSummaryItem): void;
}): JSX.Element | null {
  if (failureSummary.length === 0) {
    return null;
  }

  return (
    <section className="workflow-failure-summary">
      <header>
        <h3>Failure summary</h3>
        <span className="state-chip attention">{failureSummary.length} signals</span>
      </header>
      <div className="workflow-failure-list">
        {failureSummary.map((item) => (
          <WorkflowFailureSummaryCard key={item.id} item={item} onOpenInControl={onOpenInControl} />
        ))}
      </div>
    </section>
  );
}

function WorkflowActionAvailabilitySection({
  selectedRun
}: {
  selectedRun: WorkflowRunSummary | WorkflowRunDetail;
}): JSX.Element | null {
  if (!selectedRun.actionAvailability) {
    return null;
  }
  const availability = selectedRun.actionAvailability;

  return (
    <section>
      <h3>Action availability</h3>
      <div className="workflow-action-availability">
        <span className="state-chip">Rerun {workflowActionAvailabilityLabel(availability.canRerun)}</span>
        <span className="state-chip">
          Failed jobs {workflowActionAvailabilityLabel(availability.canRerunFailedJobs)}
        </span>
        <span className="state-chip">Cancel {workflowActionAvailabilityLabel(availability.canCancel)}</span>
      </div>
    </section>
  );
}

function WorkflowJobCard({
  job,
  selectedRunId,
  workflowListLimit,
  expanded,
  jobRerunDisabledReason,
  onRerunJob,
  onSelectJobLogs,
  onSelectJobStep,
  onToggleJobSteps
}: {
  job: WorkflowRunJobSummary;
  selectedRunId: number;
  workflowListLimit: number;
  expanded: boolean;
  jobRerunDisabledReason: string | null;
  onRerunJob(jobId: number): void;
  onSelectJobLogs(runId: number, jobId: number): void;
  onSelectJobStep(runId: number, jobId: number, stepNumber: number): void;
  onToggleJobSteps(jobId: number): void;
}): JSX.Element {
  const jobLogsDisabledReason =
    job.status === "queued" ? "Logs become available after the job starts." : null;
  const visibleSteps = expanded ? job.steps : job.steps.slice(0, workflowListLimit);

  return (
    <article className="workflow-job-card">
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
          onClick={() => onRerunJob(job.id)}
        >
          Rerun job
        </button>
        <button
          type="button"
          disabled={Boolean(jobLogsDisabledReason)}
          title={jobLogsDisabledReason ?? undefined}
          onClick={() => onSelectJobLogs(selectedRunId, job.id)}
        >
          View logs
        </button>
        {jobRerunDisabledReason && (
          <small className="action-disabled-note">Job rerun unavailable: {jobRerunDisabledReason}</small>
        )}
      </div>
      <div className="workflow-step-list">
        {visibleSteps.map((step) => (
          <button
            key={`${job.id}-${step.number}`}
            type="button"
            onClick={() => onSelectJobStep(selectedRunId, job.id, step.number)}
          >
            <span>{step.name}</span>
            <strong>{step.conclusion ?? step.status ?? "pending"}</strong>
          </button>
        ))}
        {job.steps.length > workflowListLimit && (
          <button type="button" onClick={() => onToggleJobSteps(job.id)}>
            <small>{expanded ? "Show fewer" : `Show all ${job.steps.length} steps`}</small>
          </button>
        )}
      </div>
    </article>
  );
}

function WorkflowJobsSection({
  repository,
  detail,
  selectedRunId,
  workflowJobsAvailabilityMessage,
  runDetailLoading,
  expandedItems,
  workflowListLimit,
  workflowActionPendingReason,
  liveWorkflowDisabledReason,
  onRerunJob,
  onSelectJobLogs,
  onSelectJobStep,
  onToggleJobSteps
}: {
  repository: RepositoryDetail;
  detail: WorkflowRunDetail;
  selectedRunId: number;
  workflowJobsAvailabilityMessage: string | null;
  runDetailLoading: boolean;
  expandedItems: ExpandedWorkflowDetailItems;
  workflowListLimit: number;
  workflowActionPendingReason: string | null;
  liveWorkflowDisabledReason: string | null;
  onRerunJob(jobId: number): void;
  onSelectJobLogs(runId: number, jobId: number): void;
  onSelectJobStep(runId: number, jobId: number, stepNumber: number): void;
  onToggleJobSteps(jobId: number): void;
}): JSX.Element {
  return (
    <section>
      <h3>Jobs</h3>
      {workflowJobsAvailabilityMessage && (
        <div className="error-state">{workflowJobsAvailabilityMessage}</div>
      )}
      {detail.jobs.map((job) => (
        <WorkflowJobCard
          key={job.id}
          job={job}
          selectedRunId={selectedRunId}
          workflowListLimit={workflowListLimit}
          expanded={expandedItems.jobStepIds.has(job.id)}
          jobRerunDisabledReason={
            workflowActionPendingReason ??
            liveWorkflowDisabledReason ??
            workflowJobRerunDisabledReason(repository, job)
          }
          onRerunJob={onRerunJob}
          onSelectJobLogs={onSelectJobLogs}
          onSelectJobStep={onSelectJobStep}
          onToggleJobSteps={onToggleJobSteps}
        />
      ))}
      {!runDetailLoading && !workflowJobsAvailabilityMessage && detail.jobs.length === 0 && (
        <div className="empty-state">No jobs returned for this run.</div>
      )}
    </section>
  );
}

function WorkflowJobLogPreviewSection({
  heading = "Job log preview",
  selectedLogJob,
  selectedLogStep,
  jobLogs,
  jobLogsAvailabilityMessage,
  jobLogPreviewCharacters,
  largeJobLogPreviewCharacters,
  selectedLogJobKey,
  onLoadLargePreview,
  onOpenExternal
}: {
  heading?: string;
  selectedLogJob: WorkflowRunJobSummary | null;
  selectedLogStep: WorkflowRunStepSummary | null;
  jobLogs: {
    isLoading: boolean;
    error: Error | null;
    data: WorkflowJobLogsResult | undefined;
  };
  jobLogsAvailabilityMessage: string | null;
  jobLogPreviewCharacters: number;
  largeJobLogPreviewCharacters: number;
  selectedLogJobKey: string | null;
  onLoadLargePreview(key: string): void;
  onOpenExternal(url: string): void;
}): JSX.Element {
  const displayedLog = jobLogs.data?.text
    ? workflowLogDisplay(jobLogs.data.text, selectedLogStep, selectedLogJob?.steps ?? [])
    : null;
  const logLabel = selectedLogStep ? `Step: ${selectedLogStep.name}` : selectedLogJob?.name;
  const logState = selectedLogStep
    ? (selectedLogStep.conclusion ?? selectedLogStep.status ?? "pending")
    : (selectedLogJob?.conclusion ?? selectedLogJob?.status ?? "queued");
  const truncationMessage = selectedLogStep
    ? "Showing matching lines from the loaded log text. Load more in Control if this step looks incomplete."
    : `Showing the first ${jobLogPreviewCharacters.toLocaleString()} characters. Download the complete log for the full output.`;

  return (
    <section className="workflow-log-section">
      <h3>{heading}</h3>
      {!selectedLogJob && <div className="empty-state">Select View logs on a job.</div>}
      {selectedLogJob && (
        <article className="workflow-job-card">
          <header>
            <strong>{logLabel}</strong>
            <span className={`state-chip ${workflowStateClass(logState)}`}>
              {workflowStateText(logState)}
            </span>
          </header>
          {jobLogs.isLoading && <div className="loading-state">Loading job logs…</div>}
          {jobLogs.error && <div className="error-state">Job logs unavailable: {jobLogs.error.message}</div>}
          {jobLogsAvailabilityMessage && <div className="error-state">{jobLogsAvailabilityMessage}</div>}
          {displayedLog?.message && <small className="action-disabled-note">{displayedLog.message}</small>}
          {displayedLog?.text && (
            <pre className="workflow-log-preview">
              <code>{displayedLog.text}</code>
            </pre>
          )}
          {jobLogs.data?.truncated && <small className="action-disabled-note">{truncationMessage}</small>}
          {jobLogs.data?.availability.status === "available" && !jobLogs.data.text && (
            <div className="empty-state">GitHub returned an empty log.</div>
          )}
          {jobLogs.data && (
            <div className="workflow-card-actions">
              {jobLogs.data.truncated && jobLogPreviewCharacters < largeJobLogPreviewCharacters && (
                <button
                  type="button"
                  disabled={!selectedLogJobKey}
                  onClick={() => {
                    if (selectedLogJobKey) {
                      onLoadLargePreview(selectedLogJobKey);
                    }
                  }}
                >
                  Load more in Control
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
                <ExternalLink size={15} /> Download complete log
              </button>
            </div>
          )}
        </article>
      )}
    </section>
  );
}

function WorkflowArtifactRow({
  artifact,
  selected,
  onSelect,
  onOpenExternal
}: {
  artifact: WorkflowRunArtifactSummary;
  selected: boolean;
  onSelect(artifact: WorkflowRunArtifactSummary): void;
  onOpenExternal(url: string): void;
}): JSX.Element {
  const disabledReason = artifact.expired
    ? "Artifact expired."
    : artifact.archiveDownloadUrl
      ? null
      : (readAvailabilityMessage("Artifact archive download", artifact.archiveDownloadAvailability) ??
        "Artifact download URL unavailable.");
  const dateLabels = [
    artifact.expiresAt ? `expires ${formatRelativeDate(artifact.expiresAt)}` : null,
    artifact.updatedAt ? `updated ${formatRelativeDate(artifact.updatedAt)}` : null,
    artifact.createdAt ? `created ${formatRelativeDate(artifact.createdAt)}` : null
  ].filter((label): label is string => Boolean(label));

  return (
    <article className={`workflow-artifact-row ${selected ? "active" : ""}`}>
      <div>
        <strong>{artifact.name}</strong>
        <small>
          {formatCompactNumber(artifact.sizeInBytes)} bytes · {artifact.expired ? "expired" : "available"}
          {dateLabels.length > 0 ? ` · ${dateLabels.join(" · ")}` : ""}
        </small>
      </div>
      <span className="state-chip">{artifact.expired ? "expired" : "available"}</span>
      <button type="button" onClick={() => onSelect(artifact)}>
        <Download size={15} /> Inspect
      </button>
      <button
        type="button"
        disabled={Boolean(disabledReason)}
        title={disabledReason ?? undefined}
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
}

function WorkflowArtifactsSection({
  detail,
  selectedWorkflowArtifact,
  workflowArtifactsAvailabilityMessage,
  runDetailLoading,
  onSelectArtifact,
  onOpenExternal
}: {
  detail: WorkflowRunDetail;
  selectedWorkflowArtifact: WorkflowRunArtifactSummary | null;
  workflowArtifactsAvailabilityMessage: string | null;
  runDetailLoading: boolean;
  onSelectArtifact(artifact: WorkflowRunArtifactSummary): void;
  onOpenExternal(url: string): void;
}): JSX.Element {
  const logsUnavailableMessage =
    readAvailabilityMessage("Workflow logs", detail.logs.availability) ??
    detail.logs.message ??
    "Logs unavailable";

  return (
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
          <small>{detail.logs.available ? "Temporary download ready" : logsUnavailableMessage}</small>
        </div>
        <button
          type="button"
          disabled={!detail.logs.downloadUrl}
          title={detail.logs.downloadUrl ? undefined : logsUnavailableMessage}
          onClick={() => {
            if (detail.logs.downloadUrl) {
              onOpenExternal(detail.logs.downloadUrl);
            }
          }}
        >
          Download logs
        </button>
      </article>
      {detail.artifacts.map((artifact) => (
        <WorkflowArtifactRow
          key={artifact.id}
          artifact={artifact}
          selected={selectedWorkflowArtifact?.id === artifact.id}
          onSelect={onSelectArtifact}
          onOpenExternal={onOpenExternal}
        />
      ))}
      {!runDetailLoading && !workflowArtifactsAvailabilityMessage && detail.artifacts.length === 0 && (
        <div className="empty-state">No artifacts returned for this run.</div>
      )}
    </section>
  );
}

function WorkflowAnnotationRow({
  annotation,
  onOpenInControl
}: {
  annotation: WorkflowRunCheckAnnotationSummary;
  onOpenInControl(annotation: WorkflowRunCheckAnnotationSummary): void;
}): JSX.Element {
  return (
    <div className="workflow-annotation-row">
      <div>
        <strong>{annotation.title ?? annotation.message}</strong>
        <small>
          {annotation.path}
          {annotation.startLine ? `:${annotation.startLine}` : ""}
          {annotation.endLine && annotation.endLine !== annotation.startLine ? `-${annotation.endLine}` : ""}
        </small>
        {annotation.rawDetails && <small>{annotation.rawDetails}</small>}
        {!annotation.rawDetails && annotation.title && <small>{annotation.message}</small>}
      </div>
      <span className="state-chip">{annotation.annotationLevel ?? "annotation"}</span>
      <button type="button" onClick={() => onOpenInControl(annotation)}>
        Open in Control
      </button>
    </div>
  );
}

function WorkflowCheckRunCard({
  checkRun,
  expanded,
  workflowListLimit,
  onOpenExternal,
  onOpenAnnotation,
  onToggleAnnotations
}: {
  checkRun: WorkflowRunCheckRunSummary;
  expanded: boolean;
  workflowListLimit: number;
  onOpenExternal(url: string): void;
  onOpenAnnotation(annotation: WorkflowRunCheckAnnotationSummary): void;
  onToggleAnnotations(checkRunId: number): void;
}): JSX.Element {
  const checkRunUrl = checkRun.detailsUrl ?? checkRun.htmlUrl;
  const annotationAvailabilityMessage = readAvailabilityMessage(
    "Check annotations",
    checkRun.annotationsAvailability
  );
  const visibleAnnotations = expanded
    ? checkRun.annotations
    : checkRun.annotations.slice(0, workflowListLimit);

  return (
    <article className="workflow-job-card">
      <header>
        <strong>{checkRun.name}</strong>
        <span className={`state-chip ${checkRun.conclusion === "success" ? "success" : ""}`}>
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
          disabled={!checkRunUrl}
          title={checkRunUrl ? undefined : "Check details URL unavailable."}
          onClick={() => {
            if (checkRunUrl) {
              onOpenExternal(checkRunUrl);
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
      {annotationAvailabilityMessage && <div className="error-state">{annotationAvailabilityMessage}</div>}
      {checkRun.annotations.length > 0 && (
        <div className="workflow-annotation-list">
          {visibleAnnotations.map((annotation) => (
            <WorkflowAnnotationRow
              key={`${checkRun.id}-${annotation.path}-${annotation.startLine ?? "line"}-${annotation.endLine ?? "end"}-${annotation.annotationLevel ?? "level"}-${annotation.message}`}
              annotation={annotation}
              onOpenInControl={onOpenAnnotation}
            />
          ))}
          {checkRun.annotations.length > workflowListLimit && (
            <button type="button" onClick={() => onToggleAnnotations(checkRun.id)}>
              <small>{expanded ? "Show fewer" : `Show all ${checkRun.annotations.length} annotations`}</small>
            </button>
          )}
        </div>
      )}
    </article>
  );
}

function WorkflowCheckSuiteRow({
  suite,
  onOpenSuiteCommit,
  onOpenExternal
}: {
  suite: WorkflowRunCheckSuiteSummary;
  onOpenSuiteCommit(suite: WorkflowRunCheckSuiteSummary): void;
  onOpenExternal(url: string): void;
}): JSX.Element {
  return (
    <article className="workflow-annotation-row">
      <div>
        <strong>{suite.appName ?? "GitHub check suite"}</strong>
        <small>
          {suite.latestCheckRunCount !== null
            ? `${suite.latestCheckRunCount} latest checks`
            : "Check count unavailable"}
          {suite.headBranch ? ` · ${suite.headBranch}` : ""}
          {suite.headSha ? ` · ${suite.headSha.slice(0, 7)}` : ""}
        </small>
        <small>{suite.updatedAt ? `Updated ${formatRelativeDate(suite.updatedAt)}` : "No update time"}</small>
      </div>
      <span className={`state-chip ${suite.conclusion === "success" ? "success" : ""}`}>
        {suite.conclusion ?? suite.status ?? "queued"}
      </span>
      <button
        type="button"
        disabled={!suite.headSha}
        title={suite.headSha ? undefined : "Check suite head SHA unavailable."}
        onClick={() => onOpenSuiteCommit(suite)}
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
  );
}

function WorkflowChecksSection({
  detail,
  workflowCheckRunsAvailabilityMessage,
  workflowCheckSuitesAvailabilityMessage,
  runDetailLoading,
  expandedItems,
  workflowListLimit,
  onOpenExternal,
  onOpenAnnotation,
  onOpenSuiteCommit,
  onToggleAnnotations
}: {
  detail: WorkflowRunDetail;
  workflowCheckRunsAvailabilityMessage: string | null;
  workflowCheckSuitesAvailabilityMessage: string | null;
  runDetailLoading: boolean;
  expandedItems: ExpandedWorkflowDetailItems;
  workflowListLimit: number;
  onOpenExternal(url: string): void;
  onOpenAnnotation(annotation: WorkflowRunCheckAnnotationSummary): void;
  onOpenSuiteCommit(suite: WorkflowRunCheckSuiteSummary): void;
  onToggleAnnotations(checkRunId: number): void;
}): JSX.Element {
  return (
    <section>
      <h3>Checks</h3>
      {workflowCheckRunsAvailabilityMessage && (
        <div className="error-state">{workflowCheckRunsAvailabilityMessage}</div>
      )}
      {detail.checkRuns.map((checkRun) => (
        <WorkflowCheckRunCard
          key={checkRun.id}
          checkRun={checkRun}
          expanded={expandedItems.checkAnnotationIds.has(checkRun.id)}
          workflowListLimit={workflowListLimit}
          onOpenExternal={onOpenExternal}
          onOpenAnnotation={onOpenAnnotation}
          onToggleAnnotations={onToggleAnnotations}
        />
      ))}
      {!runDetailLoading && !workflowCheckRunsAvailabilityMessage && detail.checkRuns.length === 0 && (
        <div className="empty-state">No check runs returned for this commit.</div>
      )}
      {workflowCheckSuitesAvailabilityMessage && (
        <div className="error-state">{workflowCheckSuitesAvailabilityMessage}</div>
      )}
      {detail.checkSuites.length > 0 && (
        <div className="workflow-annotation-list">
          {detail.checkSuites.map((suite) => (
            <WorkflowCheckSuiteRow
              key={suite.id}
              suite={suite}
              onOpenSuiteCommit={onOpenSuiteCommit}
              onOpenExternal={onOpenExternal}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function WorkflowRunActionsSection({
  selectedRun,
  selectedRerunDisabledReason,
  selectedFailedJobsRerunDisabledReason,
  selectedCancelDisabledReason,
  onOpenCommit,
  onRerun,
  onRerunFailedJobs,
  onCancel
}: {
  selectedRun: WorkflowRunSummary | WorkflowRunDetail;
  selectedRerunDisabledReason: string | null;
  selectedFailedJobsRerunDisabledReason: string | null;
  selectedCancelDisabledReason: string | null;
  onOpenCommit(): void;
  onRerun(): void;
  onRerunFailedJobs(): void;
  onCancel(): void;
}): JSX.Element {
  return (
    <div className="thread-actions">
      <button
        type="button"
        disabled={!selectedRun.commitSha}
        title={selectedRun.commitSha ? undefined : "Workflow run commit SHA unavailable."}
        onClick={onOpenCommit}
      >
        Open commit in Control
      </button>
      <button
        type="button"
        disabled={Boolean(selectedRerunDisabledReason)}
        title={selectedRerunDisabledReason ?? undefined}
        onClick={onRerun}
      >
        Rerun
      </button>
      <button
        type="button"
        disabled={Boolean(selectedFailedJobsRerunDisabledReason)}
        title={selectedFailedJobsRerunDisabledReason ?? undefined}
        onClick={onRerunFailedJobs}
      >
        Rerun failed jobs
      </button>
      <button
        type="button"
        disabled={Boolean(selectedCancelDisabledReason)}
        title={selectedCancelDisabledReason ?? undefined}
        onClick={onCancel}
      >
        Cancel run
      </button>
    </div>
  );
}

function WorkflowRunDetailSidebar({
  detail,
  selectedLogJob,
  onOpenRunSummary,
  onSelectJobLogs
}: {
  detail: WorkflowRunDetail;
  selectedLogJob: WorkflowRunJobSummary | null;
  onOpenRunSummary(): void;
  onSelectJobLogs(runId: number, jobId: number): void;
}): JSX.Element {
  return (
    <aside className="actions-detail-sidebar" aria-label="Workflow run navigation">
      <button
        type="button"
        className={`actions-detail-nav-item ${selectedLogJob ? "" : "active"}`}
        onClick={onOpenRunSummary}
      >
        <Home size={16} />
        <span>Summary</span>
      </button>
      <div className="actions-detail-sidebar-section">
        <header>
          <span>All jobs</span>
          <ListFilter size={15} />
        </header>
        {detail.jobs.map((job) => {
          const state = job.conclusion ?? job.status ?? "queued";
          const disabledReason =
            job.status === "queued" ? "Logs become available after the job starts." : null;

          return (
            <button
              key={job.id}
              type="button"
              className={`actions-detail-nav-item actions-job-nav-item ${
                selectedLogJob?.id === job.id ? "active" : ""
              }`}
              disabled={Boolean(disabledReason)}
              title={disabledReason ?? undefined}
              onClick={() => onSelectJobLogs(detail.id, job.id)}
            >
              <WorkflowStateIcon state={state} />
              <span>{job.name}</span>
            </button>
          );
        })}
        {detail.jobs.length === 0 && <small>No jobs returned for this run.</small>}
      </div>
      <div className="actions-detail-sidebar-section">
        <header>
          <span>Run details</span>
        </header>
        <div className="actions-detail-nav-item muted">
          <Clock3 size={16} />
          <span>Usage</span>
        </div>
        <div className="actions-detail-nav-item muted">
          <Workflow size={16} />
          <span>Workflow file</span>
        </div>
      </div>
    </aside>
  );
}

function WorkflowRunSummaryCard({
  selectedRun,
  detail
}: {
  selectedRun: WorkflowRunSummary | WorkflowRunDetail;
  detail: WorkflowRunDetail;
}): JSX.Element {
  const runDuration = formatWorkflowDuration(
    selectedRun.runStartedAt ?? selectedRun.createdAt,
    detail.updatedAt
  );
  const state = workflowRunState(selectedRun);

  return (
    <section className="actions-run-summary-card">
      <div>
        <small>Triggered via {workflowEventLabel(selectedRun.event).toLowerCase()}</small>
        <strong>
          {selectedRun.actorLogin ?? "Unknown actor"} {selectedRun.event === "push" ? "pushed" : "triggered"}
        </strong>
        <span>
          {selectedRun.commitSha ? selectedRun.commitSha.slice(0, 7) : "No commit"}
          {selectedRun.branch ? ` ${selectedRun.branch}` : ""}
        </span>
      </div>
      <div>
        <small>Status</small>
        <strong className={workflowStateClass(state)}>{workflowStateText(state)}</strong>
      </div>
      <div>
        <small>Total duration</small>
        <strong>{runDuration}</strong>
      </div>
      <div>
        <small>Artifacts</small>
        <strong>{detail.artifacts.length > 0 ? detail.artifacts.length : "-"}</strong>
      </div>
    </section>
  );
}

function WorkflowRunExecutionGraph({
  detail,
  onSelectJobLogs
}: {
  detail: WorkflowRunDetail;
  onSelectJobLogs(runId: number, jobId: number): void;
}): JSX.Element {
  return (
    <section className="actions-workflow-graph">
      <header>
        <div>
          <h3>{detail.name || "Workflow"}</h3>
          <small>on: {detail.event}</small>
        </div>
      </header>
      <div className="actions-job-node-grid">
        {detail.jobs.map((job) => {
          const state = job.conclusion ?? job.status ?? "queued";
          const jobDuration = formatWorkflowDuration(job.startedAt, job.completedAt);
          const disabledReason =
            job.status === "queued" ? "Logs become available after the job starts." : null;

          return (
            <button
              key={job.id}
              type="button"
              className="actions-job-node"
              disabled={Boolean(disabledReason)}
              title={disabledReason ?? undefined}
              onClick={() => onSelectJobLogs(detail.id, job.id)}
            >
              <WorkflowStateIcon state={state} />
              <strong>{job.name}</strong>
              <span>{jobDuration}</span>
            </button>
          );
        })}
      </div>
      {detail.jobs.length === 0 && <div className="empty-state">No jobs returned for this run.</div>}
    </section>
  );
}

function WorkflowJobStepList({
  job,
  selectedStepNumber,
  onSelectStep
}: {
  job: WorkflowRunJobSummary;
  selectedStepNumber: number | null;
  onSelectStep(jobId: number, stepNumber: number): void;
}): JSX.Element {
  return (
    <section className="actions-log-steps">
      <h3>Steps</h3>
      {job.steps.map((step) => {
        const state = step.conclusion ?? step.status ?? "pending";
        return (
          <button
            key={`${job.id}-${step.number}`}
            type="button"
            className={`actions-log-step-row ${selectedStepNumber === step.number ? "active" : ""}`}
            aria-pressed={selectedStepNumber === step.number}
            onClick={() => onSelectStep(job.id, step.number)}
          >
            <WorkflowStateIcon state={state} />
            <span>{step.name}</span>
            <strong>{formatWorkflowDuration(step.startedAt, step.completedAt)}</strong>
          </button>
        );
      })}
      {job.steps.length === 0 && <div className="empty-state">No steps returned for this job.</div>}
    </section>
  );
}

type ActionsTabProps = {
  repository: RepositoryDetail;
  githubReady: boolean;
  selectedRef: string | null;
  refListLimit: number;
  actionsLimit: number;
  workflowDefinitionLimit: number;
  focusedWorkflowId: string | null;
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
  onSelectWorkflow(workflowId: string | null, filter: string): void;
  onOpenWorkflowRunDetail(run: WorkflowRunSummary, workflowId: string | null, filter: string): void;
  onSelectWorkflowArtifact(
    run: WorkflowRunSummary | WorkflowRunDetail,
    artifact: WorkflowRunArtifactSummary
  ): void;
  onExpandActions(): void;
  onExpandWorkflowDefinitions(): void;
  onMutate(action: GitHubAction, dangerous: boolean, payload?: GitHubMutationFields): void;
};

function useActionsTabModel({
  repository,
  githubReady,
  selectedRef,
  refListLimit,
  actionsLimit,
  workflowDefinitionLimit,
  focusedWorkflowId,
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
  onSelectWorkflow,
  onOpenWorkflowRunDetail,
  onSelectWorkflowArtifact,
  onExpandActions,
  onExpandWorkflowDefinitions,
  onMutate
}: ActionsTabProps) {
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(focusedWorkflowId);
  const [filter, setFilter] = useState(initialFilter);
  const [dispatching, setDispatching] = useState(initialDispatching);
  const [workflowId, setWorkflowId] = useState("");
  const [workflowRef, setWorkflowRef] = useState(selectedRef ?? repository.defaultBranch ?? "main");
  const [workflowInputOverrides, setWorkflowInputOverrides] = useState<WorkflowDispatchInputValues>({});
  const { actions: actionsQuery, workflows } = useActionsTabQueries({
    owner: repository.owner,
    repo: repository.name,
    limit: actionsLimit,
    workflowRef,
    workflowDefinitionLimit,
    enabled: true,
    workflowsEnabled: true,
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
  const [selectedLogJobSelection, setSelectedLogJobSelection] = useState<{
    runId: number;
    jobId: number;
  } | null>(null);
  const [selectedLogStepSelection, setSelectedLogStepSelection] = useState<{
    runId: number;
    jobId: number;
    stepNumber: number;
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
  const workflowItems = workflows.data?.items ?? [];
  const selectedWorkflowForRuns =
    workflowItems.find((workflow) => workflowMatchesIdentity(workflow, selectedWorkflowId)) ?? null;
  const workflowDefinitionsAvailability = workflows.data?.availability ?? null;
  const workflowDefinitionsAvailabilityMessage = readAvailabilityMessage(
    "Workflow definitions",
    workflowDefinitionsAvailability
  );
  const filteredActions = actions.filter((run) => {
    return (
      (!selectedWorkflowForRuns || workflowMatchesRun(selectedWorkflowForRuns, run)) &&
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
  const effectiveSelectedRunId = requestedRunId ?? null;
  const selectedRunFromList =
    effectiveSelectedRunId !== null
      ? (actions.find((run) => run.id === effectiveSelectedRunId) ?? null)
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
  const selectedLogStep =
    selectedLogStepSelection &&
    selectedRun &&
    selectedLogJob &&
    selectedLogStepSelection.runId === selectedRun.id &&
    selectedLogStepSelection.jobId === selectedLogJob.id
      ? (selectedLogJob.steps.find((step) => step.number === selectedLogStepSelection.stepNumber) ?? null)
      : null;
  const defaultJobLogPreviewCharacters = 12_000;
  const largeJobLogPreviewCharacters = 250_000;
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
  const firstWorkflow =
    selectedWorkflowForRuns ??
    workflowItems.find((workflow) => workflow.dispatchable) ??
    workflowItems[0] ??
    null;
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
    workflowDispatchDisabledReason(selectedWorkflow, effectiveWorkflowId, workflowRef, workflowInputValues);
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

  function startWorkflowDispatch(): void {
    setSubmittedWorkflowAction(null);
    setSelectedLogJobSelection(null);
    setSelectedLogStepSelection(null);
    if (!workflowId && selectedWorkflowForRuns) {
      setWorkflowId(workflowIdentity(selectedWorkflowForRuns));
    }
    setDispatching(true);
  }

  function selectWorkflow(workflowId: string | null): void {
    setDispatching(false);
    setSelectedRunId(null);
    setSelectedLogJobSelection(null);
    setSelectedLogStepSelection(null);
    setSelectedWorkflowId(workflowId);
    onSelectWorkflow(workflowId, filter);
  }

  function selectWorkflowRun(run: WorkflowRunSummary): void {
    setDispatching(false);
    setSelectedRunId(run.id);
    setSelectedLogJobSelection(null);
    setSelectedLogStepSelection(null);
    onOpenWorkflowRunDetail(run, selectedWorkflowId, filter);
  }

  function openWorkflowRunList(): void {
    setDispatching(false);
    setSelectedRunId(null);
    setSelectedLogJobSelection(null);
    setSelectedLogStepSelection(null);
    onSelectWorkflow(selectedWorkflowId, filter);
  }

  function changeWorkflowId(value: string): void {
    setWorkflowId(value);
    setWorkflowInputOverrides({});
  }

  function updateWorkflowInput(name: string, value: string | boolean): void {
    setWorkflowInputOverrides((current) => ({ ...current, [name]: value }));
  }

  function submitDispatchWorkflow(): void {
    if (dispatchDisabledReason || !effectiveWorkflowId.trim() || !workflowRef.trim()) {
      return;
    }
    const inputs = selectedWorkflow
      ? workflowDispatchInputsPayload(selectedWorkflow.inputs, workflowInputValues)
      : {};
    const workflowDispatchId = selectedWorkflow?.path ?? effectiveWorkflowId.trim();
    setSubmittedWorkflowAction("dispatchWorkflow");
    onMutate("dispatchWorkflow", true, {
      workflowId: workflowDispatchId,
      ref: workflowRef.trim(),
      ...(Object.keys(inputs).length > 0 ? { inputs } : {})
    });
  }

  function cancelWorkflowDispatch(): void {
    setSubmittedWorkflowAction(null);
    setDispatching(false);
  }

  function openFailureInControl(item: WorkflowFailureSummaryItem): void {
    if (!selectedRun) {
      return;
    }
    if (item.jobId !== undefined) {
      setSelectedLogJobSelection({ runId: selectedRun.id, jobId: item.jobId });
      setSelectedLogStepSelection(null);
      return;
    }
    if (item.path) {
      onOpenCodePath(
        item.path,
        selectedRun.branch ?? selectedRun.commitSha ?? repository.defaultBranch ?? null,
        item.url,
        item.line ?? null,
        selectedRunTargetRepositoryNameWithOwner
      );
    }
  }

  function selectJobLogs(runId: number, jobId: number): void {
    setSelectedLogJobSelection({ runId, jobId });
    setSelectedLogStepSelection(null);
  }

  function selectJobStep(runId: number, jobId: number, stepNumber: number): void {
    const key = `${repository.nameWithOwner}#${runId}#${jobId}`;
    setSelectedLogJobSelection({ runId, jobId });
    setSelectedLogStepSelection({ runId, jobId, stepNumber });
    setJobLogPreviewSizeSelection({ key, maxCharacters: largeJobLogPreviewCharacters });
  }

  function openRunSummary(): void {
    setSelectedLogJobSelection(null);
    setSelectedLogStepSelection(null);
  }

  function rerunWorkflowJob(jobId: number): void {
    submitWorkflowMutation("rerunWorkflowJob", true, { jobId });
  }

  function toggleWorkflowJobSteps(jobId: number): void {
    setExpandedWorkflowDetailState((current) => {
      const currentItems =
        current.detailKey === workflowDetailKey ? current.items : initialExpandedWorkflowDetailItems;
      const jobStepIds = new Set(currentItems.jobStepIds);

      if (jobStepIds.has(jobId)) {
        jobStepIds.delete(jobId);
      } else {
        jobStepIds.add(jobId);
      }

      return {
        detailKey: workflowDetailKey,
        items: { ...currentItems, jobStepIds }
      };
    });
  }

  function loadLargeJobLogPreview(key: string): void {
    setJobLogPreviewSizeSelection({ key, maxCharacters: largeJobLogPreviewCharacters });
  }

  function selectWorkflowArtifact(artifact: WorkflowRunArtifactSummary): void {
    if (selectedRun) {
      onSelectWorkflowArtifact(selectedRun, artifact);
    }
  }

  function openCheckAnnotation(annotation: WorkflowRunCheckAnnotationSummary): void {
    if (!selectedRun) {
      return;
    }
    onOpenCodePath(
      annotation.path,
      selectedRun.branch ?? selectedRun.commitSha ?? repository.defaultBranch ?? null,
      annotation.blobHref,
      annotation.startLine ?? null,
      selectedRunTargetRepositoryNameWithOwner
    );
  }

  function openCheckSuiteCommit(suite: WorkflowRunCheckSuiteSummary): void {
    if (suite.headSha) {
      onOpenWorkflowCheckSuiteCommit(suite, selectedRunTargetRepositoryNameWithOwner);
    }
  }

  function toggleWorkflowCheckAnnotations(checkRunId: number): void {
    setExpandedWorkflowDetailState((current) => {
      const currentItems =
        current.detailKey === workflowDetailKey ? current.items : initialExpandedWorkflowDetailItems;
      const checkAnnotationIds = new Set(currentItems.checkAnnotationIds);

      if (checkAnnotationIds.has(checkRunId)) {
        checkAnnotationIds.delete(checkRunId);
      } else {
        checkAnnotationIds.add(checkRunId);
      }

      return {
        detailKey: workflowDetailKey,
        items: { ...currentItems, checkAnnotationIds }
      };
    });
  }

  function openSelectedRunCommit(): void {
    if (selectedRun?.commitSha) {
      onOpenWorkflowRunCommit(selectedRun, selectedRunTargetRepositoryNameWithOwner);
    }
  }

  function rerunSelectedWorkflow(): void {
    if (selectedRun) {
      submitWorkflowMutation("rerunWorkflow", true, { runId: selectedRun.id });
    }
  }

  function rerunSelectedFailedJobs(): void {
    if (selectedRun) {
      submitWorkflowMutation("rerunFailedWorkflowJobs", true, { runId: selectedRun.id });
    }
  }

  function cancelSelectedWorkflow(): void {
    if (selectedRun) {
      submitWorkflowMutation("cancelWorkflow", true, { runId: selectedRun.id });
    }
  }

  return {
    repository,
    filter,
    setFilter,
    workflowActionPendingReason,
    repositoryDispatchDisabledReason,
    startWorkflowDispatch,
    actions,
    filteredActions,
    selectedRun,
    dispatching,
    loading,
    error,
    actionsAvailabilityMessage,
    canExpandActions,
    actionsLimitHit,
    selectedWorkflowId,
    selectWorkflow,
    selectWorkflowRun,
    openWorkflowRunList,
    onOpenExternal,
    onExpandActions,
    workflowItems,
    workflows,
    workflowDefinitionsAvailabilityMessage,
    workflowDefinitionsEmpty,
    workflowDefinitionsLimitHit,
    canExpandWorkflowDefinitions,
    effectiveWorkflowId,
    selectedWorkflow,
    workflowInputValues,
    workflowId,
    workflowRef,
    workflowRefOptions,
    refsError,
    refsAvailabilityMessage,
    dispatchConfigurationDisabled,
    dispatchDisabledReason,
    manualWorkflowInputMetadataUnavailable,
    dispatchMutationActive,
    mutationPending,
    mutationSucceeded,
    mutationError,
    workflowDefinitionLimit,
    changeWorkflowId,
    setWorkflowRef,
    updateWorkflowInput,
    submitDispatchWorkflow,
    cancelWorkflowDispatch,
    onExpandWorkflowDefinitions,
    selectedRunSourceRepositoryNameWithOwner,
    detail,
    runDetail,
    workflowRunDetailAvailabilityMessage,
    workflowRunMutationActive,
    submittedWorkflowAction,
    failureSummary,
    openFailureInControl,
    workflowJobsAvailabilityMessage,
    expandedWorkflowDetailItems,
    workflowListLimit,
    liveWorkflowDisabledReason,
    rerunWorkflowJob,
    selectJobLogs,
    openRunSummary,
    toggleWorkflowJobSteps,
    selectJobStep,
    selectedLogJob,
    selectedLogStep,
    jobLogs,
    jobLogsAvailabilityMessage,
    jobLogPreviewCharacters,
    largeJobLogPreviewCharacters,
    selectedLogJobKey,
    loadLargeJobLogPreview,
    selectedWorkflowArtifact,
    workflowArtifactsAvailabilityMessage,
    selectWorkflowArtifact,
    workflowCheckRunsAvailabilityMessage,
    workflowCheckSuitesAvailabilityMessage,
    openCheckAnnotation,
    openCheckSuiteCommit,
    toggleWorkflowCheckAnnotations,
    selectedRerunDisabledReason,
    selectedFailedJobsRerunDisabledReason,
    selectedCancelDisabledReason,
    openSelectedRunCommit,
    rerunSelectedWorkflow,
    rerunSelectedFailedJobs,
    cancelSelectedWorkflow
  };
}

export function ActionsTab(props: ActionsTabProps): JSX.Element {
  const {
    repository,
    filter,
    setFilter,
    workflowActionPendingReason,
    repositoryDispatchDisabledReason,
    startWorkflowDispatch,
    actions,
    filteredActions,
    selectedRun,
    dispatching,
    loading,
    error,
    actionsAvailabilityMessage,
    canExpandActions,
    actionsLimitHit,
    selectedWorkflowId,
    selectWorkflow,
    selectWorkflowRun,
    openWorkflowRunList,
    onOpenExternal,
    onExpandActions,
    workflowItems,
    workflows,
    workflowDefinitionsAvailabilityMessage,
    workflowDefinitionsEmpty,
    workflowDefinitionsLimitHit,
    canExpandWorkflowDefinitions,
    effectiveWorkflowId,
    selectedWorkflow,
    workflowInputValues,
    workflowId,
    workflowRef,
    workflowRefOptions,
    refsError,
    refsAvailabilityMessage,
    dispatchConfigurationDisabled,
    dispatchDisabledReason,
    manualWorkflowInputMetadataUnavailable,
    dispatchMutationActive,
    mutationPending,
    mutationSucceeded,
    mutationError,
    workflowDefinitionLimit,
    changeWorkflowId,
    setWorkflowRef,
    updateWorkflowInput,
    submitDispatchWorkflow,
    cancelWorkflowDispatch,
    onExpandWorkflowDefinitions,
    selectedRunSourceRepositoryNameWithOwner,
    detail,
    runDetail,
    workflowRunDetailAvailabilityMessage,
    workflowRunMutationActive,
    submittedWorkflowAction,
    failureSummary,
    openFailureInControl,
    workflowJobsAvailabilityMessage,
    expandedWorkflowDetailItems,
    workflowListLimit,
    liveWorkflowDisabledReason,
    rerunWorkflowJob,
    selectJobLogs,
    openRunSummary,
    toggleWorkflowJobSteps,
    selectJobStep,
    selectedLogJob,
    selectedLogStep,
    jobLogs,
    jobLogsAvailabilityMessage,
    jobLogPreviewCharacters,
    largeJobLogPreviewCharacters,
    selectedLogJobKey,
    loadLargeJobLogPreview,
    selectedWorkflowArtifact,
    workflowArtifactsAvailabilityMessage,
    selectWorkflowArtifact,
    workflowCheckRunsAvailabilityMessage,
    workflowCheckSuitesAvailabilityMessage,
    openCheckAnnotation,
    openCheckSuiteCommit,
    toggleWorkflowCheckAnnotations,
    selectedRerunDisabledReason,
    selectedFailedJobsRerunDisabledReason,
    selectedCancelDisabledReason,
    openSelectedRunCommit,
    rerunSelectedWorkflow,
    rerunSelectedFailedJobs,
    cancelSelectedWorkflow
  } = useActionsTabModel(props);
  const activeWorkflowForList =
    workflowItems.find((workflow) => workflowMatchesIdentity(workflow, selectedWorkflowId)) ?? null;
  const actionsHeading = activeWorkflowForList?.name ?? "All workflows";
  const selectedRunState = selectedRun ? workflowRunState(selectedRun) : null;

  return (
    <section className="actions-page github-surface">
      {selectedRun && !dispatching ? (
        <>
          <header className="actions-run-titlebar">
            <div>
              <button type="button" className="actions-back-button" onClick={openWorkflowRunList}>
                <ArrowLeft size={16} /> {selectedRun.name}
              </button>
              <h2>
                {selectedRunState && <WorkflowStateIcon state={selectedRunState} />}
                <span>{selectedRun.displayTitle ?? selectedRun.name}</span>
                {selectedRun.runNumber !== null && <small>#{selectedRun.runNumber}</small>}
              </h2>
            </div>
            <WorkflowRunActionsSection
              selectedRun={selectedRun}
              selectedRerunDisabledReason={selectedRerunDisabledReason}
              selectedFailedJobsRerunDisabledReason={selectedFailedJobsRerunDisabledReason}
              selectedCancelDisabledReason={selectedCancelDisabledReason}
              onOpenCommit={openSelectedRunCommit}
              onRerun={rerunSelectedWorkflow}
              onRerunFailedJobs={rerunSelectedFailedJobs}
              onCancel={cancelSelectedWorkflow}
            />
          </header>
          <div className="actions-run-detail-layout">
            {detail ? (
              <WorkflowRunDetailSidebar
                detail={detail}
                selectedLogJob={selectedLogJob}
                onOpenRunSummary={openRunSummary}
                onSelectJobLogs={selectJobLogs}
              />
            ) : (
              <aside className="actions-detail-sidebar" aria-label="Workflow run navigation">
                <div className="loading-state">Loading run navigation…</div>
              </aside>
            )}
            <main className="thread-detail actions-run-detail-main">
              {runDetail.isLoading && <div className="loading-state">Loading run detail…</div>}
              {runDetail.error && (
                <div className="error-state">Run detail unavailable: {runDetail.error.message}</div>
              )}
              {workflowRunDetailAvailabilityMessage && (
                <div className="error-state">{workflowRunDetailAvailabilityMessage}</div>
              )}
              <WorkflowRunMutationStatus
                active={workflowRunMutationActive}
                pending={mutationPending}
                succeeded={mutationSucceeded}
                error={mutationError}
                action={submittedWorkflowAction}
              />
              {detail && selectedLogJob ? (
                <div className="actions-log-view">
                  <header className="actions-log-header">
                    <button type="button" className="actions-back-button" onClick={openRunSummary}>
                      <ArrowLeft size={16} /> Summary
                    </button>
                    <div>
                      <h3>{selectedLogJob.name}</h3>
                      <small>
                        {workflowStateText(selectedLogJob.conclusion ?? selectedLogJob.status)} ·{" "}
                        {formatWorkflowDuration(selectedLogJob.startedAt, selectedLogJob.completedAt)}
                      </small>
                    </div>
                  </header>
                  <WorkflowJobStepList
                    job={selectedLogJob}
                    selectedStepNumber={selectedLogStep?.number ?? null}
                    onSelectStep={(jobId, stepNumber) => selectJobStep(selectedRun.id, jobId, stepNumber)}
                  />
                  <WorkflowJobLogPreviewSection
                    heading="Logs"
                    selectedLogJob={selectedLogJob}
                    selectedLogStep={selectedLogStep}
                    jobLogs={{
                      isLoading: jobLogs.isLoading,
                      error: jobLogs.error instanceof Error ? jobLogs.error : null,
                      data: jobLogs.data
                    }}
                    jobLogsAvailabilityMessage={jobLogsAvailabilityMessage}
                    jobLogPreviewCharacters={jobLogPreviewCharacters}
                    largeJobLogPreviewCharacters={largeJobLogPreviewCharacters}
                    selectedLogJobKey={selectedLogJobKey}
                    onLoadLargePreview={loadLargeJobLogPreview}
                    onOpenExternal={onOpenExternal}
                  />
                </div>
              ) : detail ? (
                <div className="actions-run-summary-view">
                  <WorkflowRunSummaryCard selectedRun={selectedRun} detail={detail} />
                  <div className="workflow-summary">
                    <span>{detail.jobs.length} jobs</span>
                    <span>{detail.checkRuns.length} checks</span>
                    <span>{detail.artifacts.length} artifacts</span>
                    {selectedRun.runAttempt !== null && <span>Attempt {selectedRun.runAttempt}</span>}
                    {selectedRun.commitSha && <span>{selectedRun.commitSha.slice(0, 7)}</span>}
                    {selectedRunSourceRepositoryNameWithOwner && (
                      <span>Source {selectedRunSourceRepositoryNameWithOwner}</span>
                    )}
                  </div>
                  <WorkflowFailureSummarySection
                    failureSummary={failureSummary}
                    onOpenInControl={openFailureInControl}
                  />
                  <WorkflowRunExecutionGraph detail={detail} onSelectJobLogs={selectJobLogs} />
                  <WorkflowActionAvailabilitySection selectedRun={selectedRun} />
                  <WorkflowJobsSection
                    repository={repository}
                    detail={detail}
                    selectedRunId={selectedRun.id}
                    workflowJobsAvailabilityMessage={workflowJobsAvailabilityMessage}
                    runDetailLoading={runDetail.isLoading}
                    expandedItems={expandedWorkflowDetailItems}
                    workflowListLimit={workflowListLimit}
                    workflowActionPendingReason={workflowActionPendingReason}
                    liveWorkflowDisabledReason={liveWorkflowDisabledReason}
                    onRerunJob={rerunWorkflowJob}
                    onSelectJobLogs={selectJobLogs}
                    onSelectJobStep={selectJobStep}
                    onToggleJobSteps={toggleWorkflowJobSteps}
                  />
                  <WorkflowArtifactsSection
                    detail={detail}
                    selectedWorkflowArtifact={selectedWorkflowArtifact}
                    workflowArtifactsAvailabilityMessage={workflowArtifactsAvailabilityMessage}
                    runDetailLoading={runDetail.isLoading}
                    onSelectArtifact={selectWorkflowArtifact}
                    onOpenExternal={onOpenExternal}
                  />
                  <WorkflowChecksSection
                    detail={detail}
                    workflowCheckRunsAvailabilityMessage={workflowCheckRunsAvailabilityMessage}
                    workflowCheckSuitesAvailabilityMessage={workflowCheckSuitesAvailabilityMessage}
                    runDetailLoading={runDetail.isLoading}
                    expandedItems={expandedWorkflowDetailItems}
                    workflowListLimit={workflowListLimit}
                    onOpenExternal={onOpenExternal}
                    onOpenAnnotation={openCheckAnnotation}
                    onOpenSuiteCommit={openCheckSuiteCommit}
                    onToggleAnnotations={toggleWorkflowCheckAnnotations}
                  />
                </div>
              ) : null}
            </main>
          </div>
        </>
      ) : (
        <div className="actions-landing-layout">
          <WorkflowCatalogPane
            workflows={workflowItems}
            actions={actions}
            selectedWorkflowId={selectedWorkflowId}
            workflowsLoading={workflows.isLoading}
            workflowsFetching={workflows.isFetching}
            workflowsError={workflows.error instanceof Error ? workflows.error : null}
            workflowDefinitionsAvailabilityMessage={workflowDefinitionsAvailabilityMessage}
            workflowDefinitionsLimitHit={workflowDefinitionsLimitHit}
            canExpandWorkflowDefinitions={canExpandWorkflowDefinitions}
            workflowDefinitionLimit={workflowDefinitionLimit}
            onSelectWorkflow={selectWorkflow}
            onExpandWorkflowDefinitions={onExpandWorkflowDefinitions}
          />
          <main className="actions-landing-main">
            <WorkflowRunFilterBar
              filter={filter}
              runWorkflowDisabledReason={workflowActionPendingReason ?? repositoryDispatchDisabledReason}
              onFilterChange={setFilter}
              onStartDispatch={startWorkflowDispatch}
            />
            {dispatching ? (
              <WorkflowDispatchForm
                repository={repository}
                workflowItems={workflowItems}
                workflowsLoading={workflows.isLoading}
                workflowsFetching={workflows.isFetching}
                workflowsError={workflows.error instanceof Error ? workflows.error : null}
                workflowDefinitionsAvailabilityMessage={workflowDefinitionsAvailabilityMessage}
                workflowDefinitionsEmpty={workflowDefinitionsEmpty}
                workflowDefinitionsLimitHit={workflowDefinitionsLimitHit}
                canExpandWorkflowDefinitions={canExpandWorkflowDefinitions}
                effectiveWorkflowId={effectiveWorkflowId}
                selectedWorkflow={selectedWorkflow}
                workflowInputValues={workflowInputValues}
                workflowId={workflowId}
                workflowRef={workflowRef}
                workflowRefOptions={workflowRefOptions}
                refsError={refsError}
                refsAvailabilityMessage={refsAvailabilityMessage}
                dispatchConfigurationDisabled={dispatchConfigurationDisabled}
                repositoryDispatchDisabledReason={repositoryDispatchDisabledReason}
                dispatchDisabledReason={dispatchDisabledReason}
                manualWorkflowInputMetadataUnavailable={manualWorkflowInputMetadataUnavailable}
                dispatchMutationActive={dispatchMutationActive}
                mutationPending={mutationPending}
                mutationSucceeded={mutationSucceeded}
                mutationError={mutationError}
                workflowDefinitionLimit={workflowDefinitionLimit}
                onWorkflowIdChange={changeWorkflowId}
                onRefChange={setWorkflowRef}
                onWorkflowInputChange={updateWorkflowInput}
                onSubmitDispatch={submitDispatchWorkflow}
                onCancelDispatch={cancelWorkflowDispatch}
                onExpandWorkflowDefinitions={onExpandWorkflowDefinitions}
              />
            ) : (
              <>
                <header className="actions-list-heading">
                  <div>
                    <h2>{actionsHeading}</h2>
                    <small>
                      {activeWorkflowForList
                        ? `Showing runs for ${activeWorkflowForList.path}.`
                        : "Showing runs from all workflows."}
                    </small>
                  </div>
                  <span className="state-chip">{filteredActions.length} runs</span>
                </header>
                <WorkflowRunList
                  repository={repository}
                  actions={actions}
                  filteredActions={filteredActions}
                  selectedRunId={selectedRun?.id ?? null}
                  dispatching={dispatching}
                  loading={loading}
                  error={error instanceof Error ? error : null}
                  actionsAvailabilityMessage={actionsAvailabilityMessage}
                  filter={filter}
                  canExpandActions={canExpandActions}
                  actionsLimitHit={actionsLimitHit}
                  onSelectRun={selectWorkflowRun}
                  onExpandActions={onExpandActions}
                />
              </>
            )}
          </main>
        </div>
      )}
    </section>
  );
}
