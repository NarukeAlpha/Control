import type {
  ActionsInput,
  GitHubReadAvailability,
  WorkflowDefinitionListResult,
  WorkflowDefinitionSummary,
  WorkflowDispatchInputSummary,
  WorkflowDispatchInputType,
  WorkflowJobLogsInput,
  WorkflowJobLogsResult,
  WorkflowListInput,
  WorkflowRunArtifactSummary,
  WorkflowRunCheckAnnotationSummary,
  WorkflowRunCheckRunSummary,
  WorkflowRunCheckSuiteSummary,
  WorkflowRunDetail,
  WorkflowRunDetailInput,
  WorkflowRunDetailResult,
  WorkflowRunJobSummary,
  WorkflowRunListResult,
  WorkflowRunLogsSummary,
  WorkflowRunSummary
} from "@shared/github";

export interface OctokitWorkflowClient {
  rest<T>(route: string, params?: Record<string, unknown>): Promise<T>;
  restResponse<T>(
    route: string,
    params?: Record<string, unknown>
  ): Promise<{ data: T; headers: Record<string, string | number | undefined> }>;
  restText(route: string, params?: Record<string, unknown>): Promise<string>;
  restPaginatedArray<T>(route: string, params: Record<string, unknown>, limit: number): Promise<T[]>;
  restPaginatedWrapped<T, K extends string>(
    route: string,
    key: K,
    params: Record<string, unknown>,
    limit: number
  ): Promise<T[]>;
}

const workflowCheckRunAnnotationLimit = 10;
const defaultWorkflowDefinitionLimit = 50;
const maxWorkflowDefinitionLimit = 100;

export class OctokitWorkflowDomain {
  constructor(
    private readonly client: OctokitWorkflowClient,
    private readonly mapError: (error: unknown) => GitHubReadAvailability
  ) {}

  async listActions(input: ActionsInput): Promise<WorkflowRunSummary[]> {
    const workflowRuns = await this.client.restPaginatedWrapped<GitHubWorkflowRun, "workflow_runs">(
      "GET /repos/{owner}/{repo}/actions/runs",
      "workflow_runs",
      {
        owner: input.owner,
        repo: input.repo
      },
      input.limit ?? 30
    );
    return workflowRuns.map(mapWorkflowRun);
  }

  async listActionsWithStatus(input: ActionsInput): Promise<WorkflowRunListResult> {
    try {
      return {
        items: await this.listActions(input),
        availability: { status: "available", message: null }
      };
    } catch (error: unknown) {
      return {
        items: [],
        availability: this.mapError(error)
      };
    }
  }

  async listWorkflows(input: WorkflowListInput): Promise<WorkflowDefinitionSummary[]> {
    const limit = Math.min(
      Math.max(input.limit ?? defaultWorkflowDefinitionLimit, 0),
      maxWorkflowDefinitionLimit
    );
    const workflows = await this.client.restPaginatedWrapped<GitHubWorkflowDefinition, "workflows">(
      "GET /repos/{owner}/{repo}/actions/workflows",
      "workflows",
      {
        owner: input.owner,
        repo: input.repo
      },
      limit
    );

    return Promise.all(
      workflows.map(async (workflow) => {
        const dispatch = await this.fetchWorkflowDispatchMetadata(input, workflow.path);
        return {
          id: workflow.id,
          nodeId: workflow.node_id ?? null,
          name: workflow.name,
          path: workflow.path,
          state: workflow.state,
          htmlUrl: workflow.html_url ?? null,
          badgeUrl: workflow.badge_url ?? null,
          createdAt: workflow.created_at ?? null,
          updatedAt: workflow.updated_at ?? null,
          ...dispatch
        };
      })
    );
  }

  async listWorkflowsWithStatus(input: WorkflowListInput): Promise<WorkflowDefinitionListResult> {
    try {
      return {
        items: await this.listWorkflows(input),
        availability: { status: "available", message: null }
      };
    } catch (error: unknown) {
      return {
        items: [],
        availability: this.mapError(error)
      };
    }
  }

  async getWorkflowRunDetail(input: WorkflowRunDetailInput): Promise<WorkflowRunDetail> {
    const run = await this.client.rest<GitHubWorkflowRun>("GET /repos/{owner}/{repo}/actions/runs/{run_id}", {
      owner: input.owner,
      repo: input.repo,
      run_id: input.runId
    });

    const [jobsResult, artifactsResult, checks, logs] = await Promise.all([
      this.client
        .restPaginatedWrapped<GitHubWorkflowJob, "jobs">(
          "GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs",
          "jobs",
          {
            owner: input.owner,
            repo: input.repo,
            run_id: input.runId
          },
          100
        )
        .then((jobs) => ({
          jobs,
          availability: { status: "available", message: null } as GitHubReadAvailability
        }))
        .catch((error) => ({
          jobs: [],
          availability: this.mapError(error)
        })),
      this.client
        .restPaginatedWrapped<GitHubWorkflowArtifact, "artifacts">(
          "GET /repos/{owner}/{repo}/actions/runs/{run_id}/artifacts",
          "artifacts",
          {
            owner: input.owner,
            repo: input.repo,
            run_id: input.runId
          },
          100
        )
        .then((artifacts) => ({
          artifacts,
          availability: { status: "available", message: null } as GitHubReadAvailability
        }))
        .catch((error) => ({
          artifacts: [],
          availability: this.mapError(error)
        })),
      this.fetchWorkflowChecks(input.owner, input.repo, run.head_sha),
      this.fetchWorkflowRunLogs(input.owner, input.repo, input.runId, run.logs_url ?? null)
    ]);

    const artifactSummaries = await Promise.all(
      artifactsResult.artifacts.map((artifact) => this.mapWorkflowArtifact(input.owner, input.repo, artifact))
    );

    return {
      ...mapWorkflowRun(run),
      jobs: jobsResult.jobs.map(mapWorkflowJob),
      jobsAvailability: jobsResult.availability,
      artifacts: artifactSummaries,
      artifactsAvailability: artifactsResult.availability,
      checkSuites: checks.checkSuites,
      checkSuitesAvailability: checks.checkSuitesAvailability,
      checkRuns: checks.checkRuns,
      checkRunsAvailability: checks.checkRunsAvailability,
      logs
    };
  }

  async getWorkflowRunDetailWithStatus(input: WorkflowRunDetailInput): Promise<WorkflowRunDetailResult> {
    try {
      return {
        detail: await this.getWorkflowRunDetail(input),
        availability: { status: "available", message: null }
      };
    } catch (error: unknown) {
      return {
        detail: null,
        availability: this.mapError(error)
      };
    }
  }

  async getWorkflowJobLogs(input: WorkflowJobLogsInput): Promise<WorkflowJobLogsResult> {
    const maxCharacters = Math.min(Math.max(input.maxCharacters ?? 12_000, 1_000), 50_000);

    try {
      const response = await this.client.restResponse<void>(
        "GET /repos/{owner}/{repo}/actions/jobs/{job_id}/logs",
        {
          owner: input.owner,
          repo: input.repo,
          job_id: input.jobId,
          request: { redirect: "manual" }
        }
      );
      const downloadUrl = getResponseHeader(response.headers, "location");
      if (!downloadUrl) {
        return {
          jobId: input.jobId,
          text: "",
          truncated: false,
          downloadUrl: null,
          availability: {
            status: "error",
            message: "GitHub did not return a temporary job log URL."
          }
        };
      }

      const logResponse = await fetch(downloadUrl, { headers: { accept: "text/plain" } });
      if (!logResponse.ok) {
        return {
          jobId: input.jobId,
          text: "",
          truncated: false,
          downloadUrl,
          availability: {
            status: "error",
            message: `GitHub returned ${logResponse.status} while downloading job logs.`
          }
        };
      }

      const text = await logResponse.text();
      return {
        jobId: input.jobId,
        text: text.slice(0, maxCharacters),
        truncated: text.length > maxCharacters,
        downloadUrl,
        availability: { status: "available", message: null }
      };
    } catch (error: unknown) {
      return {
        jobId: input.jobId,
        text: "",
        truncated: false,
        downloadUrl: null,
        availability: this.mapError(error)
      };
    }
  }

  private async fetchWorkflowDispatchMetadata(
    input: WorkflowListInput,
    path: string
  ): Promise<Pick<WorkflowDefinitionSummary, "dispatchable" | "inputs" | "inputsUnavailableMessage">> {
    try {
      const content = await this.client.restText("GET /repos/{owner}/{repo}/contents/{path}", {
        owner: input.owner,
        repo: input.repo,
        path,
        ref: input.ref ?? undefined,
        headers: { accept: "application/vnd.github.raw" }
      });
      return parseWorkflowDispatchMetadata(content);
    } catch (error: unknown) {
      return {
        dispatchable: false,
        inputs: [],
        inputsUnavailableMessage:
          error instanceof Error ? error.message : "Workflow dispatch inputs could not be loaded."
      };
    }
  }

  private async fetchWorkflowChecks(
    owner: string,
    repo: string,
    ref: string | null
  ): Promise<
    Pick<WorkflowRunDetail, "checkSuites" | "checkSuitesAvailability" | "checkRuns" | "checkRunsAvailability">
  > {
    if (!ref) {
      const availability: GitHubReadAvailability = {
        status: "feature_disabled",
        message: "Workflow run check data cannot be loaded because GitHub did not return a head SHA."
      };
      return {
        checkSuites: [],
        checkSuitesAvailability: availability,
        checkRuns: [],
        checkRunsAvailability: availability
      };
    }

    const [suitesResult, runsResult] = await Promise.all([
      this.client
        .restPaginatedWrapped<GitHubCheckSuite, "check_suites">(
          "GET /repos/{owner}/{repo}/commits/{ref}/check-suites",
          "check_suites",
          {
            owner,
            repo,
            ref
          },
          100
        )
        .then((checkSuites) => ({
          checkSuites,
          availability: { status: "available", message: null } as GitHubReadAvailability
        }))
        .catch((error) => ({
          checkSuites: [],
          availability: this.mapError(error)
        })),
      this.client
        .restPaginatedWrapped<GitHubCheckRun, "check_runs">(
          "GET /repos/{owner}/{repo}/commits/{ref}/check-runs",
          "check_runs",
          {
            owner,
            repo,
            ref
          },
          100
        )
        .then((checkRuns) => ({
          checkRuns,
          availability: { status: "available", message: null } as GitHubReadAvailability
        }))
        .catch((error) => ({
          checkRuns: [],
          availability: this.mapError(error)
        }))
    ]);

    const checkRuns = await Promise.all(
      runsResult.checkRuns.map(async (checkRun) => {
        const mapped = mapWorkflowCheckRun(checkRun);
        if (mapped.annotationsCount === 0) {
          return mapped;
        }

        try {
          const annotations = await this.client.restPaginatedArray<GitHubCheckRunAnnotation>(
            "GET /repos/{owner}/{repo}/check-runs/{check_run_id}/annotations",
            {
              owner,
              repo,
              check_run_id: mapped.id
            },
            workflowCheckRunAnnotationLimit
          );
          return {
            ...mapped,
            annotations: annotations.map((annotation) =>
              mapWorkflowCheckRunAnnotation(owner, repo, ref, annotation)
            ),
            annotationsAvailability: { status: "available", message: null } as GitHubReadAvailability
          };
        } catch (error: unknown) {
          return {
            ...mapped,
            annotations: [],
            annotationsAvailability: this.mapError(error)
          };
        }
      })
    );

    return {
      checkSuites: suitesResult.checkSuites.map(mapWorkflowCheckSuite),
      checkSuitesAvailability: suitesResult.availability,
      checkRuns,
      checkRunsAvailability: runsResult.availability
    };
  }

  private async mapWorkflowArtifact(
    owner: string,
    repo: string,
    artifact: GitHubWorkflowArtifact
  ): Promise<WorkflowRunArtifactSummary> {
    const archiveDownload = await this.fetchWorkflowArtifactArchiveDownloadUrl(owner, repo, artifact);
    return mapWorkflowArtifact(artifact, archiveDownload.url, archiveDownload.availability);
  }

  private async fetchWorkflowArtifactArchiveDownloadUrl(
    owner: string,
    repo: string,
    artifact: GitHubWorkflowArtifact
  ): Promise<{ url: string | null; availability: GitHubReadAvailability }> {
    if (artifact.expired) {
      return {
        url: null,
        availability: {
          status: "feature_disabled",
          message: "This artifact has expired and can no longer be downloaded."
        }
      };
    }

    try {
      const response = await this.client.restResponse<void>(
        "GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}/{archive_format}",
        {
          owner,
          repo,
          artifact_id: artifact.id,
          archive_format: "zip",
          request: { redirect: "manual" }
        }
      );
      const url = getResponseHeader(response.headers, "location");
      return {
        url,
        availability: url
          ? { status: "available", message: null }
          : {
              status: "error",
              message: "GitHub did not return a temporary artifact download URL."
            }
      };
    } catch (error: unknown) {
      return {
        url: null,
        availability: this.mapError(error)
      };
    }
  }

  private async fetchWorkflowRunLogs(
    owner: string,
    repo: string,
    runId: number,
    apiUrl: string | null
  ): Promise<WorkflowRunLogsSummary> {
    if (!apiUrl) {
      const availability: GitHubReadAvailability = {
        status: "feature_disabled",
        message: "GitHub did not return a logs endpoint for this workflow run."
      };
      return {
        apiUrl: null,
        downloadUrl: null,
        available: false,
        message: availability.message,
        availability
      };
    }

    try {
      const response = await this.client.restResponse<void>(
        "GET /repos/{owner}/{repo}/actions/runs/{run_id}/logs",
        {
          owner,
          repo,
          run_id: runId,
          request: { redirect: "manual" }
        }
      );
      const downloadUrl = getResponseHeader(response.headers, "location");
      const availability: GitHubReadAvailability = downloadUrl
        ? { status: "available", message: null }
        : {
            status: "error",
            message: "GitHub did not return a temporary log download URL."
          };
      return {
        apiUrl,
        downloadUrl,
        available: Boolean(downloadUrl),
        message: availability.message,
        availability
      };
    } catch (error: unknown) {
      const availability = this.mapError(error);
      return {
        apiUrl,
        downloadUrl: null,
        available: false,
        message: availability.message,
        availability
      };
    }
  }
}

function getResponseHeader(
  headers: Record<string, string | number | undefined>,
  name: string
): string | null {
  const value = headers[name] ?? headers[name.toLowerCase()];
  return typeof value === "string" && value ? value : null;
}

function mapWorkflowRun(run: GitHubWorkflowRun): WorkflowRunSummary {
  const rerunUrl = run.rerun_url ?? null;
  const rerunFailedJobsUrl = run.rerun_failed_jobs_url ?? null;
  const cancelUrl = run.cancel_url ?? null;
  const previousAttemptUrl =
    run.previous_attempt_url && run.run_attempt && run.run_attempt > 1
      ? `${run.html_url}/attempts/${run.run_attempt - 1}`
      : null;
  const completed = run.status === null ? null : run.status === "completed";
  const failed = run.conclusion === null ? null : run.conclusion === "failure";

  return {
    id: run.id,
    name: run.name,
    displayTitle: run.display_title ?? null,
    runNumber: run.run_number ?? null,
    runAttempt: run.run_attempt ?? null,
    event: run.event,
    status: run.status,
    conclusion: run.conclusion,
    branch: run.head_branch,
    commitSha: run.head_sha,
    headRepositoryNameWithOwner: run.head_repository?.full_name ?? null,
    actorLogin: run.actor?.login ?? null,
    actorAvatarUrl: run.actor?.avatar_url ?? null,
    triggeringActorLogin: run.triggering_actor?.login ?? null,
    runStartedAt: run.run_started_at ?? null,
    createdAt: run.created_at,
    updatedAt: run.updated_at,
    htmlUrl: run.html_url,
    actionAvailability: {
      canRerun: completed === null ? null : completed && Boolean(rerunUrl),
      canRerunFailedJobs:
        completed === null || failed === null ? null : completed && failed && Boolean(rerunFailedJobsUrl),
      canCancel: completed === null ? null : !completed && Boolean(cancelUrl),
      rerunUrl,
      rerunFailedJobsUrl,
      cancelUrl,
      previousAttemptUrl
    }
  };
}

function parseWorkflowDispatchMetadata(
  content: string
): Pick<WorkflowDefinitionSummary, "dispatchable" | "inputs" | "inputsUnavailableMessage"> {
  const lines = parseYamlLines(content);
  const onIndex = lines.findIndex((line) => line.indent === 0 && line.key === "on");
  if (onIndex < 0) {
    return { dispatchable: false, inputs: [], inputsUnavailableMessage: null };
  }

  const onLine = lines[onIndex]!;
  if (yamlScalarIncludesWorkflowDispatch(onLine.value)) {
    return { dispatchable: true, inputs: [], inputsUnavailableMessage: null };
  }

  const workflowDispatchIndex = findYamlChildLine(lines, onIndex, onLine.indent, "workflow_dispatch");
  if (workflowDispatchIndex < 0) {
    return { dispatchable: false, inputs: [], inputsUnavailableMessage: null };
  }

  const workflowDispatchLine = lines[workflowDispatchIndex]!;
  const inputsIndex = findYamlChildLine(lines, workflowDispatchIndex, workflowDispatchLine.indent, "inputs");
  if (inputsIndex < 0) {
    return { dispatchable: true, inputs: [], inputsUnavailableMessage: null };
  }

  return {
    dispatchable: true,
    inputs: parseWorkflowDispatchInputs(lines, inputsIndex),
    inputsUnavailableMessage: null
  };
}

interface ParsedYamlLine {
  indent: number;
  content: string;
  key: string | null;
  value: string;
}

function parseYamlLines(content: string): ParsedYamlLine[] {
  return content
    .split(/\r?\n/)
    .map((rawLine) => {
      const withoutComment = stripYamlComment(rawLine);
      if (!withoutComment.trim()) {
        return null;
      }

      const indent = withoutComment.search(/\S/);
      const lineContent = withoutComment.trim();
      const colonIndex = findYamlKeySeparator(lineContent);
      if (colonIndex < 0 || lineContent.startsWith("- ")) {
        return {
          indent,
          content: lineContent,
          key: null,
          value: ""
        };
      }

      return {
        indent,
        content: lineContent,
        key: normalizeYamlKey(lineContent.slice(0, colonIndex)),
        value: lineContent.slice(colonIndex + 1).trim()
      };
    })
    .filter((line): line is ParsedYamlLine => Boolean(line));
}

function stripYamlComment(line: string): string {
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
    } else if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
    } else if (
      char === "#" &&
      !inSingleQuote &&
      !inDoubleQuote &&
      (index === 0 || /\s/.test(line[index - 1] ?? ""))
    ) {
      return line.slice(0, index);
    }
  }

  return line;
}

function findYamlKeySeparator(content: string): number {
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
    } else if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
    } else if (char === ":" && !inSingleQuote && !inDoubleQuote) {
      return index;
    }
  }

  return -1;
}

function normalizeYamlKey(key: string): string {
  return stripYamlQuotes(key.trim());
}

function stripYamlQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function yamlScalarIncludesWorkflowDispatch(value: string): boolean {
  const scalar = value.trim();
  if (!scalar) {
    return false;
  }
  if (stripYamlQuotes(scalar) === "workflow_dispatch") {
    return true;
  }
  if (scalar.startsWith("[") && scalar.endsWith("]")) {
    return parseInlineYamlList(scalar).includes("workflow_dispatch");
  }
  return false;
}

function findYamlChildLine(
  lines: ParsedYamlLine[],
  parentIndex: number,
  parentIndent: number,
  key: string
): number {
  for (let index = parentIndex + 1; index < lines.length; index += 1) {
    const line = lines[index]!;
    if (line.indent <= parentIndent) {
      break;
    }
    if (line.key === key) {
      return index;
    }
  }

  return -1;
}

function parseWorkflowDispatchInputs(
  lines: ParsedYamlLine[],
  inputsIndex: number
): WorkflowDispatchInputSummary[] {
  const inputsIndent = lines[inputsIndex]!.indent;
  const inputs: WorkflowDispatchInputSummary[] = [];
  let inputIndent: number | null = null;
  let current: WorkflowDispatchInputSummary | null = null;
  let optionsIndent: number | null = null;

  for (let index = inputsIndex + 1; index < lines.length; index += 1) {
    const line = lines[index]!;
    if (line.indent <= inputsIndent) {
      break;
    }

    if (inputIndent === null && line.key) {
      inputIndent = line.indent;
      current = createWorkflowDispatchInput(line.key);
      optionsIndent = null;
      continue;
    }

    if (inputIndent !== null && line.indent === inputIndent && line.key) {
      if (current) {
        inputs.push(current);
      }
      current = createWorkflowDispatchInput(line.key);
      optionsIndent = null;
      continue;
    }

    if (!current) {
      continue;
    }

    if (optionsIndent !== null && line.indent > optionsIndent && line.content.startsWith("- ")) {
      current.options.push(parseYamlScalar(line.content.slice(2)));
      continue;
    }

    if (!line.key) {
      continue;
    }

    switch (line.key) {
      case "description":
        current.description = parseYamlScalar(line.value) || null;
        break;
      case "required":
        current.required = parseYamlBoolean(line.value);
        break;
      case "type":
        current.type = normalizeWorkflowDispatchInputType(parseYamlScalar(line.value));
        break;
      case "default":
        current.defaultValue = parseYamlScalar(line.value);
        break;
      case "options":
        current.options = parseInlineYamlList(line.value);
        optionsIndent = line.indent;
        break;
      default:
        break;
    }
  }

  if (current) {
    inputs.push(current);
  }

  return inputs;
}

function createWorkflowDispatchInput(name: string): WorkflowDispatchInputSummary {
  return {
    name,
    description: null,
    required: false,
    type: "string",
    defaultValue: null,
    options: []
  };
}

function parseYamlScalar(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "{}" || trimmed === "[]") {
    return "";
  }
  return stripYamlQuotes(trimmed);
}

function parseYamlBoolean(value: string): boolean {
  const parsed = parseYamlScalar(value).toLowerCase();
  return parsed === "true" || parsed === "yes" || parsed === "on";
}

function normalizeWorkflowDispatchInputType(value: string): WorkflowDispatchInputType {
  return value === "boolean" ||
    value === "choice" ||
    value === "number" ||
    value === "environment" ||
    value === "string"
    ? value
    : "string";
}

function parseInlineYamlList(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
    return [];
  }

  return trimmed
    .slice(1, -1)
    .split(",")
    .map((option) => parseYamlScalar(option))
    .filter(Boolean);
}

function mapWorkflowJob(job: GitHubWorkflowJob): WorkflowRunJobSummary {
  return {
    id: job.id,
    name: job.name,
    status: job.status,
    conclusion: job.conclusion,
    startedAt: job.started_at ?? null,
    completedAt: job.completed_at ?? null,
    htmlUrl: job.html_url ?? null,
    runnerName: job.runner_name ?? null,
    labels: job.labels ?? [],
    steps: (job.steps ?? []).map((step) => ({
      name: step.name,
      status: step.status,
      conclusion: step.conclusion,
      number: step.number,
      startedAt: step.started_at ?? null,
      completedAt: step.completed_at ?? null
    }))
  };
}

function mapWorkflowArtifact(
  artifact: GitHubWorkflowArtifact,
  archiveDownloadUrl: string | null,
  archiveDownloadAvailability: GitHubReadAvailability
): WorkflowRunArtifactSummary {
  return {
    id: artifact.id,
    name: artifact.name,
    sizeInBytes: artifact.size_in_bytes,
    expired: artifact.expired,
    createdAt: artifact.created_at,
    updatedAt: artifact.updated_at,
    expiresAt: artifact.expires_at ?? null,
    archiveDownloadUrl,
    archiveDownloadAvailability
  };
}

function mapWorkflowCheckSuite(suite: GitHubCheckSuite): WorkflowRunCheckSuiteSummary {
  return {
    id: suite.id,
    status: suite.status ?? null,
    conclusion: suite.conclusion ?? null,
    headBranch: suite.head_branch ?? null,
    headSha: suite.head_sha ?? null,
    beforeSha: suite.before ?? null,
    afterSha: suite.after ?? null,
    appName: suite.app?.name ?? null,
    appSlug: suite.app?.slug ?? null,
    appHtmlUrl: suite.app?.html_url ?? null,
    latestCheckRunCount: suite.latest_check_runs_count ?? null,
    createdAt: suite.created_at ?? null,
    updatedAt: suite.updated_at ?? null
  };
}

function mapWorkflowCheckRun(run: GitHubCheckRun): WorkflowRunCheckRunSummary {
  return {
    id: run.id,
    name: run.name,
    status: run.status ?? null,
    conclusion: run.conclusion ?? null,
    startedAt: run.started_at ?? null,
    completedAt: run.completed_at ?? null,
    htmlUrl: run.html_url ?? null,
    detailsUrl: run.details_url ?? null,
    checkSuiteId: run.check_suite?.id ?? null,
    appName: run.app?.name ?? null,
    appSlug: run.app?.slug ?? null,
    appHtmlUrl: run.app?.html_url ?? null,
    outputTitle: run.output?.title ?? null,
    outputSummary: run.output?.summary ?? null,
    outputText: run.output?.text ?? null,
    annotationsCount: run.output?.annotations_count ?? 0,
    annotations: [],
    annotationsAvailability: { status: "available", message: null }
  };
}

function mapWorkflowCheckRunAnnotation(
  owner: string,
  repo: string,
  ref: string | null,
  annotation: GitHubCheckRunAnnotation
): WorkflowRunCheckAnnotationSummary {
  return {
    path: annotation.path,
    startLine: annotation.start_line ?? null,
    endLine: annotation.end_line ?? null,
    annotationLevel: annotation.annotation_level ?? null,
    title: annotation.title ?? null,
    message: annotation.message,
    rawDetails: annotation.raw_details ?? null,
    blobHref: mapWorkflowCheckRunAnnotationBlobHref(owner, repo, ref, annotation)
  };
}

function mapWorkflowCheckRunAnnotationBlobHref(
  owner: string,
  repo: string,
  ref: string | null,
  annotation: GitHubCheckRunAnnotation
): string | null {
  if (annotation.blob_href?.startsWith("https://github.com/")) {
    return annotation.blob_href;
  }

  if (!ref || !annotation.path) {
    return null;
  }

  const startLine = annotation.start_line ?? null;
  const endLine = annotation.end_line ?? null;
  const lineFragment =
    startLine === null
      ? ""
      : endLine !== null && endLine !== startLine
        ? `#L${startLine}-L${endLine}`
        : `#L${startLine}`;

  return `https://github.com/${owner}/${repo}/blob/${encodeURIComponent(ref)}/${encodePath(annotation.path)}${lineFragment}`;
}

function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

export interface GitHubWorkflowRun {
  id: number;
  name: string;
  display_title?: string | null;
  run_number?: number | null;
  run_attempt?: number | null;
  event: string;
  status: string | null;
  conclusion: string | null;
  head_branch: string | null;
  head_sha: string | null;
  head_repository?: { full_name?: string | null } | null;
  actor?: { login: string; avatar_url?: string | null } | null;
  triggering_actor?: { login: string } | null;
  run_started_at?: string | null;
  created_at: string;
  updated_at: string;
  html_url: string;
  logs_url?: string | null;
  rerun_url?: string | null;
  rerun_failed_jobs_url?: string | null;
  cancel_url?: string | null;
  previous_attempt_url?: string | null;
}

export interface GitHubWorkflowDefinition {
  id: number;
  node_id?: string | null;
  name: string;
  path: string;
  state: string;
  html_url?: string | null;
  badge_url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface GitHubWorkflowJob {
  id: number;
  name: string;
  status: string | null;
  conclusion: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  html_url?: string | null;
  runner_name?: string | null;
  labels?: string[];
  steps?: Array<{
    name: string;
    status: string | null;
    conclusion: string | null;
    number: number;
    started_at?: string | null;
    completed_at?: string | null;
  }>;
}

export interface GitHubWorkflowArtifact {
  id: number;
  name: string;
  size_in_bytes: number;
  expired: boolean;
  created_at: string;
  updated_at: string;
  expires_at?: string | null;
}

interface GitHubCheckApp {
  name?: string | null;
  slug?: string | null;
  html_url?: string | null;
}

export interface GitHubCheckSuite {
  id: number;
  status?: string | null;
  conclusion?: string | null;
  head_branch?: string | null;
  head_sha?: string | null;
  before?: string | null;
  after?: string | null;
  app?: GitHubCheckApp | null;
  latest_check_runs_count?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface GitHubCheckRun {
  id: number;
  name: string;
  status?: string | null;
  conclusion?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  html_url?: string | null;
  details_url?: string | null;
  check_suite?: { id?: number | null } | null;
  app?: GitHubCheckApp | null;
  output?: {
    title?: string | null;
    summary?: string | null;
    text?: string | null;
    annotations_count?: number | null;
  } | null;
}

export interface GitHubCheckRunAnnotation {
  path: string;
  start_line?: number | null;
  end_line?: number | null;
  annotation_level?: string | null;
  title?: string | null;
  message: string;
  raw_details?: string | null;
  blob_href?: string | null;
}
