import { ChevronDown, Download, ExternalLink, Search, Workflow } from "lucide-react";
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
  onOpenExternal,
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
  onOpenExternal(url: string): void;
  onExpandWorkflowDefinitions(): void;
}): JSX.Element {
  const selectedAllRuns = selectedWorkflowId === null;

  return (
    <section className="workflow-catalog" aria-label="Workflow catalog">
      <header>
        <strong>Workflows</strong>
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
          <strong>All runs</strong>
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
            <button
              type="button"
              className="pin-row-button"
              disabled={!workflow.htmlUrl}
              title={workflow.htmlUrl ? "Open workflow on GitHub" : "Workflow URL unavailable."}
              onClick={() => {
                if (workflow.htmlUrl) {
                  onOpenExternal(workflow.htmlUrl);
                }
              }}
            >
              <ExternalLink size={15} />
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
  onOpenExternal,
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
  onOpenExternal(url: string): void;
  onExpandActions(): void;
}): JSX.Element {
  return (
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
        <div className="muted-row">Showing the first {actions.length} workflow runs returned by GitHub.</div>
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
              selectedRunId === run.id && !dispatching ? "active" : ""
            }`}
            key={run.id}
          >
            <button className="thread-list-row-main" type="button" onClick={() => onSelectRun(run)}>
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
              aria-label={`Open workflow run ${run.displayTitle ?? run.name} on GitHub`}
              title="Open workflow run on GitHub"
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

function WorkflowRunHeaderSummary({
  selectedRun,
  sourceRepositoryNameWithOwner,
  detail
}: {
  selectedRun: WorkflowRunSummary | WorkflowRunDetail;
  sourceRepositoryNameWithOwner: string | null;
  detail: WorkflowRunDetail | null;
}): JSX.Element {
  return (
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
        {sourceRepositoryNameWithOwner && <span>Source {sourceRepositoryNameWithOwner}</span>}
        <span>{selectedRun.commitSha?.slice(0, 7) ?? "No commit"}</span>
        {selectedRun.triggeringActorLogin && <span>Triggered by {selectedRun.triggeringActorLogin}</span>}
        {detail && <span>{detail.jobs.length} jobs</span>}
        {detail && <span>{detail.checkRuns.length} checks</span>}
        {detail && <span>{detail.artifacts.length} artifacts</span>}
      </div>
    </>
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
  onOpenInControl,
  onOpenExternal
}: {
  item: WorkflowFailureSummaryItem;
  onOpenInControl(item: WorkflowFailureSummaryItem): void;
  onOpenExternal(url: string): void;
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
          Open on GitHub
        </button>
      </div>
    </article>
  );
}

function WorkflowFailureSummarySection({
  failureSummary,
  onOpenInControl,
  onOpenExternal
}: {
  failureSummary: WorkflowFailureSummaryItem[];
  onOpenInControl(item: WorkflowFailureSummaryItem): void;
  onOpenExternal(url: string): void;
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
          <WorkflowFailureSummaryCard
            key={item.id}
            item={item}
            onOpenInControl={onOpenInControl}
            onOpenExternal={onOpenExternal}
          />
        ))}
      </div>
    </section>
  );
}

function WorkflowActionAvailabilitySection({
  selectedRun,
  onOpenExternal
}: {
  selectedRun: WorkflowRunSummary | WorkflowRunDetail;
  onOpenExternal(url: string): void;
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
        {availability.previousAttemptUrl && (
          <button type="button" onClick={() => onOpenExternal(availability.previousAttemptUrl!)}>
            Previous attempt
          </button>
        )}
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
  onOpenExternal,
  onToggleJobSteps
}: {
  job: WorkflowRunJobSummary;
  selectedRunId: number;
  workflowListLimit: number;
  expanded: boolean;
  jobRerunDisabledReason: string | null;
  onRerunJob(jobId: number): void;
  onSelectJobLogs(runId: number, jobId: number): void;
  onOpenExternal(url: string): void;
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
          <small className="action-disabled-note">Job rerun unavailable: {jobRerunDisabledReason}</small>
        )}
      </div>
      <div className="workflow-step-list">
        {visibleSteps.map((step) => (
          <div key={`${job.id}-${step.number}`}>
            <span>{step.name}</span>
            <strong>{step.conclusion ?? step.status ?? "pending"}</strong>
          </div>
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
  onOpenExternal,
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
  onOpenExternal(url: string): void;
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
          onOpenExternal={onOpenExternal}
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
  selectedLogJob,
  jobLogs,
  jobLogsAvailabilityMessage,
  jobLogPreviewCharacters,
  largeJobLogPreviewCharacters,
  selectedLogJobKey,
  onLoadLargePreview,
  onOpenExternal
}: {
  selectedLogJob: WorkflowRunJobSummary | null;
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
  return (
    <section>
      <h3>Job log preview</h3>
      {!selectedLogJob && <div className="empty-state">Select View logs on a job.</div>}
      {selectedLogJob && (
        <article className="workflow-job-card">
          <header>
            <strong>{selectedLogJob.name}</strong>
            <span className={`state-chip ${selectedLogJob.conclusion === "success" ? "success" : ""}`}>
              {selectedLogJob.conclusion ?? selectedLogJob.status ?? "queued"}
            </span>
          </header>
          {jobLogs.isLoading && <div className="loading-state">Loading job logs…</div>}
          {jobLogs.error && <div className="error-state">Job logs unavailable: {jobLogs.error.message}</div>}
          {jobLogsAvailabilityMessage && <div className="error-state">{jobLogsAvailabilityMessage}</div>}
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
  onOpenInControl,
  onOpenExternal
}: {
  annotation: WorkflowRunCheckAnnotationSummary;
  onOpenInControl(annotation: WorkflowRunCheckAnnotationSummary): void;
  onOpenExternal(url: string): void;
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
        Open on GitHub
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
              onOpenExternal={onOpenExternal}
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
  onOpenExternal,
  onRerun,
  onRerunFailedJobs,
  onCancel
}: {
  selectedRun: WorkflowRunSummary | WorkflowRunDetail;
  selectedRerunDisabledReason: string | null;
  selectedFailedJobsRerunDisabledReason: string | null;
  selectedCancelDisabledReason: string | null;
  onOpenCommit(): void;
  onOpenExternal(url: string): void;
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
      <button type="button" onClick={() => onOpenExternal(selectedRun.htmlUrl)}>
        <ExternalLink size={16} /> Open on GitHub
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
      {selectedRerunDisabledReason && (
        <small className="action-disabled-note">Rerun unavailable: {selectedRerunDisabledReason}</small>
      )}
      {selectedFailedJobsRerunDisabledReason && (
        <small className="action-disabled-note">
          Failed-job rerun unavailable: {selectedFailedJobsRerunDisabledReason}
        </small>
      )}
      {selectedCancelDisabledReason && (
        <small className="action-disabled-note">Cancel unavailable: {selectedCancelDisabledReason}</small>
      )}
    </div>
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
  const effectiveSelectedRunId = requestedRunId ?? filteredActions[0]?.id ?? null;
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
    if (!workflowId && selectedWorkflowForRuns) {
      setWorkflowId(workflowIdentity(selectedWorkflowForRuns));
    }
    setDispatching(true);
  }

  function selectWorkflow(workflowId: string | null): void {
    setDispatching(false);
    setSelectedRunId(null);
    setSelectedWorkflowId(workflowId);
    onSelectWorkflow(workflowId, filter);
  }

  function selectWorkflowRun(run: WorkflowRunSummary): void {
    setDispatching(false);
    setSelectedRunId(run.id);
    onOpenWorkflowRunDetail(run, selectedWorkflowId, filter);
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
    toggleWorkflowJobSteps,
    selectedLogJob,
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
    toggleWorkflowJobSteps,
    selectedLogJob,
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

  return (
    <section className="table-panel github-surface">
      <WorkflowRunFilterBar
        filter={filter}
        runWorkflowDisabledReason={workflowActionPendingReason ?? repositoryDispatchDisabledReason}
        onFilterChange={setFilter}
        onStartDispatch={startWorkflowDispatch}
      />
      <div className="github-split">
        <div className="thread-list workflow-list-stack">
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
            onOpenExternal={onOpenExternal}
            onExpandWorkflowDefinitions={onExpandWorkflowDefinitions}
          />
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
            onOpenExternal={onOpenExternal}
            onExpandActions={onExpandActions}
          />
        </div>

        <div className="thread-detail">
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
          ) : selectedRun ? (
            <>
              <WorkflowRunHeaderSummary
                selectedRun={selectedRun}
                sourceRepositoryNameWithOwner={selectedRunSourceRepositoryNameWithOwner}
                detail={detail}
              />
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
              {detail && (
                <div className="workflow-detail-grid">
                  <WorkflowFailureSummarySection
                    failureSummary={failureSummary}
                    onOpenInControl={openFailureInControl}
                    onOpenExternal={onOpenExternal}
                  />
                  <WorkflowActionAvailabilitySection
                    selectedRun={selectedRun}
                    onOpenExternal={onOpenExternal}
                  />
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
                    onOpenExternal={onOpenExternal}
                    onToggleJobSteps={toggleWorkflowJobSteps}
                  />
                  <WorkflowJobLogPreviewSection
                    selectedLogJob={selectedLogJob}
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
              )}
              <WorkflowRunActionsSection
                selectedRun={selectedRun}
                selectedRerunDisabledReason={selectedRerunDisabledReason}
                selectedFailedJobsRerunDisabledReason={selectedFailedJobsRerunDisabledReason}
                selectedCancelDisabledReason={selectedCancelDisabledReason}
                onOpenCommit={openSelectedRunCommit}
                onOpenExternal={onOpenExternal}
                onRerun={rerunSelectedWorkflow}
                onRerunFailedJobs={rerunSelectedFailedJobs}
                onCancel={cancelSelectedWorkflow}
              />
            </>
          ) : (
            <div className="empty-state">No workflow runs found.</div>
          )}
        </div>
      </div>
    </section>
  );
}
