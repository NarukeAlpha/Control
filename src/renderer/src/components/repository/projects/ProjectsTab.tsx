import { ChevronDown, ExternalLink, Plus, Search, SquareKanban, X } from "lucide-react";
import { useMemo, useState, type JSX } from "react";
import { useQuery, type QueryClient } from "@tanstack/react-query";

import type {
  GitHubAction,
  GitHubMutationFields,
  ProjectItemFieldValueSummary,
  ProjectListResult,
  ProjectSummary,
  RepositoryDetail
} from "@shared/github";
import type { ControlApi } from "@shared/ipc";

import { MarkdownBody, markdownProjectUrlContext } from "@renderer/components/MarkdownBody";

import {
  githubActionLabel,
  readAvailabilityMessage,
  repositoryMutationDisabledReason,
  repositoryPath
} from "@renderer/components/repository/repositoryUi";

import { useControlApi } from "@renderer/hooks/useControlApi";

import { formatCompactNumber, formatRelativeDate } from "@renderer/utils/format";
import { useIssuesTabQueries } from "../issues/IssuesTab";
import { usePullRequestsTabQueries } from "../pull-requests/PullRequestsTab";
const maxProjectsLimit = 100;

export interface ProjectsTabQueryInput {
  owner: string;
  repo: string;
  limit: number;
  enabled: boolean;
  githubReady: boolean;
}

export interface ProjectsTabPrefetchInput {
  api: ControlApi;
  owner: string;
  repo: string;
  limit: number;
  githubReady: boolean;
}

export function projectsTabQueryKey(
  owner: string,
  repo: string,
  limit: number
): readonly ["projects", string, string, number] {
  return ["projects", owner, repo, limit] as const;
}

export function useProjectsTabQueries({ owner, repo, limit, enabled, githubReady }: ProjectsTabQueryInput) {
  const api = useControlApi();

  const projects = useQuery<ProjectListResult>({
    queryKey: projectsTabQueryKey(owner, repo, limit),
    queryFn: () => api.github.listProjectsWithStatus({ owner, repo, limit, cacheOnly: !githubReady }),
    enabled,
    staleTime: 60_000
  });

  return { projects };
}

export async function prefetchProjectsTabData(
  queryClient: QueryClient,
  { api, owner, repo, limit, githubReady }: ProjectsTabPrefetchInput
): Promise<void> {
  await queryClient.prefetchQuery({
    queryKey: projectsTabQueryKey(owner, repo, limit),
    queryFn: () => api.github.listProjectsWithStatus({ owner, repo, limit, cacheOnly: !githubReady }),
    staleTime: 60_000
  });
}

export function ProjectsTab({
  repository,
  githubReady,
  projectsLimit,
  focusedProjectId,
  onOpenExternal,
  onSelectProject,
  onExpandProjects,
  mutationAction,
  mutationPending,
  mutationSucceeded,
  mutationError,
  onMutate
}: {
  repository: RepositoryDetail;
  githubReady: boolean;
  projectsLimit: number;
  focusedProjectId: string | null;
  onOpenExternal(url: string): void;
  onSelectProject(project: ProjectSummary): void;
  onExpandProjects(): void;
  mutationAction: GitHubAction | null;
  mutationPending: boolean;
  mutationSucceeded: boolean;
  mutationError: Error | null;
  onMutate(action: GitHubAction, dangerous: boolean, payload?: GitHubMutationFields): void;
}): JSX.Element {
  const { projects: projectsQuery } = useProjectsTabQueries({
    owner: repository.owner,
    repo: repository.name,
    limit: projectsLimit,
    enabled: true,
    githubReady
  });
  const { issues } = useIssuesTabQueries({
    owner: repository.owner,
    repo: repository.name,
    issueListLimit: 100,
    issuesEnabled: true,
    resourcesEnabled: false,
    githubReady
  });
  const { pulls } = usePullRequestsTabQueries({
    owner: repository.owner,
    repo: repository.name,
    pullRequestListLimit: 100,
    pullsEnabled: true,
    resourcesEnabled: false,
    githubReady
  });
  const projects = projectsQuery.data?.items ?? [];
  const availability = projectsQuery.data?.availability ?? null;
  const loading = projectsQuery.isLoading || projectsQuery.isFetching;
  const error = projectsQuery.error;
  const [filter, setFilter] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    focusedProjectId ?? projects[0]?.id ?? null
  );
  const [creatingProject, setCreatingProject] = useState(false);
  const [editingProject, setEditingProject] = useState(false);
  const [projectTitle, setProjectTitle] = useState("");
  const [projectShortDescription, setProjectShortDescription] = useState("");
  const [projectReadme, setProjectReadme] = useState("");
  const [projectItemContentId, setProjectItemContentId] = useState("");
  const [projectFieldEditKey, setProjectFieldEditKey] = useState<string | null>(null);
  const [projectFieldEditValue, setProjectFieldEditValue] = useState("");
  const [submittedProjectAction, setSubmittedProjectAction] = useState<GitHubAction | null>(null);
  const normalizedFilter = filter.trim().toLowerCase();
  const filteredProjects = normalizedFilter
    ? projects.filter((project) =>
        [
          project.title,
          project.shortDescription,
          project.readme,
          project.ownerLogin,
          project.number ? `#${project.number}` : null,
          project.closed ? "closed" : "open",
          project.isPublic === null ? null : project.isPublic ? "public" : "private",
          ...project.items.map((item) =>
            [item.title, item.contentType, item.state, item.repositoryNameWithOwner, item.number].join(" ")
          ),
          ...project.fields.map((field) => `${field.name} ${field.dataType ?? ""}`)
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedFilter))
      )
    : projects;
  const selectedProject =
    filteredProjects.find((project) => project.id === selectedProjectId) ?? filteredProjects[0] ?? null;
  const projectExternalReason = selectedProject?.htmlUrl ? null : "External project URL unavailable.";
  const ownerExternalReason = selectedProject?.ownerHtmlUrl ? null : "Project owner URL unavailable.";
  const availabilityMessage = readAvailabilityMessage("Projects", availability);
  const disabledFeatureMessage =
    !availabilityMessage && repository.administration.features.projects === false
      ? "Projects are disabled for this repository."
      : null;
  const projectsLimitHit = projects.length >= projectsLimit;
  const canExpandProjects = !disabledFeatureMessage && projectsLimitHit && projectsLimit < maxProjectsLimit;
  const projectItemOptions = useMemo(() => {
    const issueItems = issues.data?.items ?? [];
    const pullItems = pulls.data?.items ?? [];
    return [
      ...issueItems.map((issue) => ({
        id: issue.nodeId,
        label: `Issue #${issue.number}: ${issue.title}`,
        state: issue.state
      })),
      ...pullItems.map((pull) => ({
        id: pull.nodeId,
        label: `PR #${pull.number}: ${pull.title}`,
        state: pull.merged ? "merged" : pull.state
      }))
    ].filter((item): item is { id: string; label: string; state: string } => Boolean(item.id));
  }, [issues.data?.items, pulls.data?.items]);
  const selectedProjectItem =
    projectItemOptions.find((item) => item.id === projectItemContentId) ?? projectItemOptions[0] ?? null;
  const liveProjectDisabledReason = !githubReady ? "Sign in with GitHub to change projects." : null;
  const projectFeatureDisabledReason =
    repository.administration.features.projects === false
      ? "Projects are disabled for this repository."
      : null;
  const projectMutationDisabledReason =
    liveProjectDisabledReason ?? projectFeatureDisabledReason ?? repositoryMutationDisabledReason(repository);
  const selectedProjectMutationDisabledReason =
    projectMutationDisabledReason ??
    (selectedProject?.viewerCanUpdate === false ? "Your token cannot update this project." : null);
  const projectMutationAction =
    mutationAction === "createProjectV2" ||
    mutationAction === "updateProjectV2" ||
    mutationAction === "deleteProjectV2" ||
    mutationAction === "addProjectV2Item" ||
    mutationAction === "updateProjectV2Item" ||
    mutationAction === "deleteProjectV2Item"
      ? mutationAction
      : null;
  const projectActionPendingReason =
    mutationPending && projectMutationAction
      ? `${githubActionLabel(projectMutationAction)} is still running.`
      : null;
  const projectFormMode = creatingProject ? "create" : editingProject && selectedProject ? "edit" : null;
  const projectFormAction: GitHubAction =
    projectFormMode === "create" ? "createProjectV2" : "updateProjectV2";
  const projectFormSubmitDisabledReason =
    projectActionPendingReason ??
    projectMutationDisabledReason ??
    (!projectTitle.trim() ? "Project title is required." : null);
  const projectEditDisabledReason =
    projectActionPendingReason ??
    selectedProjectMutationDisabledReason ??
    (!selectedProject ? "Select a project first." : null);
  const projectDeleteDisabledReason =
    projectActionPendingReason ??
    selectedProjectMutationDisabledReason ??
    (!selectedProject ? "Select a project first." : null);
  const projectAddItemDisabledReason =
    projectActionPendingReason ??
    selectedProjectMutationDisabledReason ??
    (!selectedProject ? "Select a project first." : null) ??
    (!selectedProjectItem ? "No loaded issue or pull request has a GitHub node ID." : null);
  const projectDeleteItemDisabledReason =
    projectActionPendingReason ??
    selectedProjectMutationDisabledReason ??
    (!selectedProject ? "Select a project first." : null);
  const projectMutationStatusActive =
    submittedProjectAction !== null && projectMutationAction === submittedProjectAction;

  function projectFieldForValue(fieldValue: ProjectItemFieldValueSummary) {
    return selectedProject?.fields.find((field) => field.id === fieldValue.fieldId) ?? null;
  }

  function projectFieldEditInputType(fieldValue: ProjectItemFieldValueSummary): string {
    if (fieldValue.dataType === "NUMBER") {
      return "number";
    }
    if (fieldValue.dataType === "DATE") {
      return "date";
    }
    return "text";
  }

  function projectFieldEditDisabledReasonFor(fieldValue: ProjectItemFieldValueSummary): string | null {
    const field = projectFieldForValue(fieldValue);
    const fieldOptions = field?.options ?? fieldValue.options;
    const normalizedValue = projectFieldEditValue.trim();

    return (
      projectActionPendingReason ??
      selectedProjectMutationDisabledReason ??
      (!fieldValue.editable ? "This field value is read-only in Control." : null) ??
      (!fieldValue.fieldId ? "GitHub did not return a field ID for this value." : null) ??
      (!selectedProject ? "Select a project first." : null) ??
      (!["TEXT", "NUMBER", "DATE", "SINGLE_SELECT"].includes(fieldValue.dataType ?? "")
        ? "Control can edit text, number, date, and single-select project fields only."
        : null) ??
      (fieldValue.dataType === "NUMBER" && !normalizedValue ? "Number fields require a value." : null) ??
      (fieldValue.dataType === "NUMBER" && Number.isNaN(Number(normalizedValue))
        ? "Number fields require a numeric value."
        : null) ??
      (fieldValue.dataType === "DATE" && !normalizedValue ? "Date fields require a value." : null) ??
      (fieldValue.dataType === "DATE" && normalizedValue && !/^\d{4}-\d{2}-\d{2}$/.test(normalizedValue)
        ? "Date fields require YYYY-MM-DD."
        : null) ??
      (fieldValue.dataType === "SINGLE_SELECT" && fieldOptions.length === 0
        ? "GitHub did not return selectable options for this field."
        : null) ??
      (fieldValue.dataType === "SINGLE_SELECT" && !normalizedValue
        ? "Choose a single-select option."
        : null) ??
      (String(fieldValue.optionId ?? fieldValue.value ?? "") === projectFieldEditValue
        ? "No field value changes to save."
        : null)
    );
  }

  function projectFieldMutationValue(
    fieldValue: ProjectItemFieldValueSummary
  ): NonNullable<GitHubMutationFields["value"]> {
    const normalizedValue = projectFieldEditValue.trim();
    if (fieldValue.dataType === "NUMBER") {
      return { number: Number(normalizedValue) };
    }
    if (fieldValue.dataType === "DATE") {
      return { date: normalizedValue };
    }
    if (fieldValue.dataType === "SINGLE_SELECT") {
      return { singleSelectOptionId: normalizedValue };
    }
    return { text: projectFieldEditValue };
  }

  function beginCreatingProject(): void {
    setSubmittedProjectAction(null);
    setCreatingProject(true);
    setEditingProject(false);
    setProjectFieldEditKey(null);
    setProjectTitle("");
    setProjectShortDescription("");
    setProjectReadme("");
  }

  function beginEditingProject(project: ProjectSummary): void {
    setSubmittedProjectAction(null);
    setCreatingProject(false);
    setEditingProject(true);
    setProjectFieldEditKey(null);
    setSelectedProjectId(project.id);
    setProjectTitle(project.title);
    setProjectShortDescription(project.shortDescription ?? "");
    setProjectReadme(project.readme ?? "");
  }

  function beginEditingProjectField(itemId: string, fieldValue: ProjectItemFieldValueSummary): void {
    setSubmittedProjectAction(null);
    setProjectFieldEditKey(`${itemId}:${fieldValue.id}`);
    setProjectFieldEditValue(String(fieldValue.optionId ?? fieldValue.value ?? ""));
  }

  function submitProjectMutation(
    action: GitHubAction,
    dangerous: boolean,
    payload?: GitHubMutationFields
  ): void {
    setSubmittedProjectAction(action);
    onMutate(action, dangerous, payload);
  }

  return (
    <section className="table-panel github-surface">
      <div className="table-action-row surface-filter-row">
        <label className="surface-filter">
          <Search size={15} />
          <input
            aria-label="Filter projects"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter projects"
          />
        </label>
        <button
          type="button"
          disabled={Boolean(projectActionPendingReason ?? projectMutationDisabledReason)}
          title={projectActionPendingReason ?? projectMutationDisabledReason ?? undefined}
          onClick={beginCreatingProject}
        >
          <Plus size={16} /> New project
        </button>
        <button type="button" onClick={() => onOpenExternal(repositoryPath(repository, "/projects"))}>
          <ExternalLink size={16} /> GitHub fallback
        </button>
      </div>
      <div className="github-split">
        <div className="thread-list">
          {loading && projects.length === 0 && <div className="loading-state">Loading projects…</div>}
          {availabilityMessage && <div className="error-state">{availabilityMessage}</div>}
          {!loading && disabledFeatureMessage && <div className="empty-state">{disabledFeatureMessage}</div>}
          {error && <div className="error-state">Projects unavailable: {error.message}</div>}
          {canExpandProjects && (
            <div className="table-action-row">
              <button type="button" onClick={onExpandProjects}>
                <ChevronDown size={16} /> Load more projects
              </button>
            </div>
          )}
          {!canExpandProjects && projectsLimitHit && (
            <div className="muted-row">Showing the first {projects.length} projects returned by GitHub.</div>
          )}
          {filteredProjects.map((project) => (
            <div
              className={`issue-row thread-list-action-row ${selectedProject?.id === project.id ? "active" : ""}`}
              key={project.id}
            >
              <button
                className="thread-list-row-main"
                type="button"
                onClick={() => {
                  setCreatingProject(false);
                  setEditingProject(false);
                  setSelectedProjectId(project.id);
                  onSelectProject(project);
                }}
              >
                <SquareKanban size={17} />
                <div>
                  <strong>{project.title}</strong>
                  <small>
                    {[
                      project.ownerLogin ?? "Repository project",
                      project.itemsCount === null
                        ? "items unavailable"
                        : `${formatCompactNumber(project.itemsCount)} items`,
                      project.fieldsCount === null
                        ? "fields unavailable"
                        : `${formatCompactNumber(project.fieldsCount)} fields`,
                      project.updatedAt
                        ? `updated ${formatRelativeDate(project.updatedAt)}`
                        : "no update timestamp"
                    ].join(" · ")}
                  </small>
                </div>
                <span className={`state-chip ${project.closed ? "" : "success"}`}>
                  {project.closed ? "closed" : "open"}
                </span>
                {project.isPublic !== null && (
                  <span className="state-chip">{project.isPublic ? "public" : "private"}</span>
                )}
                {project.viewerCanUpdate !== null && (
                  <span className="state-chip">{project.viewerCanUpdate ? "can update" : "read-only"}</span>
                )}
              </button>
              <button
                className="pin-row-button"
                type="button"
                aria-label={`Open GitHub fallback for ${project.title}`}
                disabled={!project.htmlUrl}
                title={
                  project.htmlUrl ? `Open GitHub fallback for ${project.title}` : "Project URL unavailable."
                }
                onClick={() => {
                  if (project.htmlUrl) {
                    onOpenExternal(project.htmlUrl);
                  }
                }}
              >
                <ExternalLink size={15} />
              </button>
            </div>
          ))}
          {!loading &&
            !error &&
            !availabilityMessage &&
            !disabledFeatureMessage &&
            filteredProjects.length === 0 && (
              <div className="empty-state">
                {filter.trim() ? "No projects match this filter." : "No projects returned."}
              </div>
            )}
        </div>

        <div className="thread-detail">
          {projectFormMode ? (
            <form
              className="compose-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (projectFormSubmitDisabledReason) {
                  return;
                }

                if (projectFormMode === "create") {
                  submitProjectMutation("createProjectV2", false, { title: projectTitle.trim() });
                  return;
                }

                if (selectedProject) {
                  submitProjectMutation("updateProjectV2", false, {
                    projectId: selectedProject.id,
                    title: projectTitle.trim(),
                    shortDescription: projectShortDescription.trim() || null,
                    readme: projectReadme
                  });
                }
              }}
            >
              <h2>{projectFormMode === "create" ? "Create project" : "Edit project"}</h2>
              {projectMutationStatusActive && mutationPending && (
                <div className="loading-state">
                  {githubActionLabel(projectFormAction)} is running. The form is locked until GitHub responds.
                </div>
              )}
              {projectMutationStatusActive && !mutationPending && mutationSucceeded && (
                <div className="success-state">
                  {githubActionLabel(projectFormAction)} completed. Project data is refreshing.
                </div>
              )}
              {projectMutationStatusActive && !mutationPending && mutationError && (
                <div className="error-state">
                  {githubActionLabel(projectFormAction)} failed: {mutationError.message}
                </div>
              )}
              <input
                disabled={Boolean(projectActionPendingReason ?? projectMutationDisabledReason)}
                title={projectActionPendingReason ?? projectMutationDisabledReason ?? undefined}
                value={projectTitle}
                onChange={(event) => setProjectTitle(event.target.value)}
                placeholder="Project title"
              />
              {projectFormMode === "edit" && (
                <>
                  <input
                    disabled={Boolean(projectActionPendingReason ?? projectMutationDisabledReason)}
                    title={projectActionPendingReason ?? projectMutationDisabledReason ?? undefined}
                    value={projectShortDescription}
                    onChange={(event) => setProjectShortDescription(event.target.value)}
                    placeholder="Short description"
                  />
                  <textarea
                    disabled={Boolean(projectActionPendingReason ?? projectMutationDisabledReason)}
                    title={projectActionPendingReason ?? projectMutationDisabledReason ?? undefined}
                    value={projectReadme}
                    onChange={(event) => setProjectReadme(event.target.value)}
                    placeholder="Project README"
                  />
                </>
              )}
              <div className="thread-actions">
                <button
                  type="submit"
                  disabled={Boolean(projectFormSubmitDisabledReason)}
                  title={projectFormSubmitDisabledReason ?? undefined}
                >
                  <SquareKanban size={16} />{" "}
                  {projectFormMode === "create" ? "Create project" : "Save project"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreatingProject(false);
                    setEditingProject(false);
                    setSubmittedProjectAction(null);
                  }}
                >
                  Cancel
                </button>
              </div>
              {projectFormSubmitDisabledReason && (
                <small className="action-disabled-note">{projectFormSubmitDisabledReason}</small>
              )}
            </form>
          ) : selectedProject ? (
            <>
              <header className="thread-header">
                <h2>{selectedProject.title}</h2>
                <small>
                  {[
                    selectedProject.number ? `#${selectedProject.number}` : null,
                    selectedProject.ownerLogin,
                    selectedProject.createdAt
                      ? `created ${formatRelativeDate(selectedProject.createdAt)}`
                      : null,
                    selectedProject.updatedAt
                      ? `updated ${formatRelativeDate(selectedProject.updatedAt)}`
                      : "no update timestamp"
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </small>
                <span className={`state-chip ${selectedProject.closed ? "" : "success"}`}>
                  {selectedProject.closed ? "closed" : "open"}
                </span>
              </header>
              <div className="workflow-summary">
                <span>
                  {selectedProject.itemsCount === null
                    ? "Items unavailable"
                    : `${formatCompactNumber(selectedProject.itemsCount)} items`}
                </span>
                <span>
                  {selectedProject.fieldsCount === null
                    ? "Fields unavailable"
                    : `${formatCompactNumber(selectedProject.fieldsCount)} fields`}
                </span>
                {selectedProject.isPublic !== null && (
                  <span>{selectedProject.isPublic ? "Public" : "Private"}</span>
                )}
                {selectedProject.viewerCanUpdate !== null && (
                  <span>{selectedProject.viewerCanUpdate ? "Viewer can update" : "Viewer read-only"}</span>
                )}
                <span>Managed in Control</span>
              </div>
              {selectedProject.shortDescription && (
                <p className="project-description">{selectedProject.shortDescription}</p>
              )}
              {selectedProject.readme ? (
                <div className="project-readme-panel">
                  <MarkdownBody
                    markdown={selectedProject.readme}
                    onOpenExternal={onOpenExternal}
                    urlContext={markdownProjectUrlContext(selectedProject, repository)}
                  />
                </div>
              ) : (
                <div className="empty-state">No project README returned.</div>
              )}
              <div className="project-field-list" aria-label="Project fields">
                {selectedProject.fields.length > 0 ? (
                  selectedProject.fields.map((field) => (
                    <span className="state-chip" key={field.id}>
                      {field.name}
                      {field.dataType ? ` · ${field.dataType.toLowerCase().replaceAll("_", " ")}` : ""}
                    </span>
                  ))
                ) : (
                  <span className="action-disabled-note">No project fields returned.</span>
                )}
              </div>
              <section className="workflow-detail-grid">
                <div>
                  <h3>Project items</h3>
                  {selectedProject.items.length > 0 ? (
                    selectedProject.items.map((item) => (
                      <article className="workflow-artifact-row" key={item.id}>
                        <div>
                          <strong>{item.title ?? item.contentType ?? item.type ?? "Project item"}</strong>
                          <small>
                            {[
                              item.contentType ?? item.type,
                              item.number === null ? null : `#${item.number}`,
                              item.state,
                              item.repositoryNameWithOwner,
                              item.updatedAt ? `updated ${formatRelativeDate(item.updatedAt)}` : null
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </small>
                        </div>
                        {item.state && <span className="state-chip">{item.state.toLowerCase()}</span>}
                        {item.fieldValues.length > 0 && (
                          <div className="project-field-list" aria-label={`${item.title ?? item.id} fields`}>
                            {item.fieldValues.map((fieldValue) => {
                              const editKey = `${item.id}:${fieldValue.id}`;
                              const editingFieldValue = projectFieldEditKey === editKey;
                              const field = projectFieldForValue(fieldValue);
                              const fieldOptions = field?.options ?? fieldValue.options;
                              const fieldLabel = fieldValue.fieldName ?? "Project field";
                              const fieldDisplayValue =
                                fieldValue.optionName ?? fieldValue.value ?? "No value returned";
                              const fieldEditDisabledReason = editingFieldValue
                                ? projectFieldEditDisabledReasonFor(fieldValue)
                                : (projectActionPendingReason ?? selectedProjectMutationDisabledReason);

                              return (
                                <div className="project-field-value-row" key={fieldValue.id}>
                                  {editingFieldValue ? (
                                    <form
                                      className="repository-admin-form repository-admin-inline-form"
                                      onSubmit={(event) => {
                                        event.preventDefault();
                                        if (
                                          fieldEditDisabledReason ||
                                          !fieldValue.fieldId ||
                                          !selectedProject
                                        ) {
                                          return;
                                        }
                                        submitProjectMutation("updateProjectV2Item", false, {
                                          projectId: selectedProject.id,
                                          itemId: item.id,
                                          fieldId: fieldValue.fieldId,
                                          value: projectFieldMutationValue(fieldValue)
                                        });
                                      }}
                                    >
                                      <label>
                                        {fieldLabel}
                                        {fieldValue.dataType === "SINGLE_SELECT" ? (
                                          <select
                                            value={projectFieldEditValue}
                                            disabled={Boolean(projectActionPendingReason)}
                                            title={projectActionPendingReason ?? undefined}
                                            onChange={(event) => setProjectFieldEditValue(event.target.value)}
                                          >
                                            {!projectFieldEditValue && (
                                              <option value="">Choose option</option>
                                            )}
                                            {fieldOptions.map((option) => (
                                              <option key={option.id} value={option.id}>
                                                {option.name}
                                              </option>
                                            ))}
                                          </select>
                                        ) : (
                                          <input
                                            type={projectFieldEditInputType(fieldValue)}
                                            value={projectFieldEditValue}
                                            disabled={Boolean(projectActionPendingReason)}
                                            title={projectActionPendingReason ?? undefined}
                                            onChange={(event) => setProjectFieldEditValue(event.target.value)}
                                          />
                                        )}
                                      </label>
                                      <button
                                        type="submit"
                                        disabled={Boolean(fieldEditDisabledReason)}
                                        title={fieldEditDisabledReason ?? undefined}
                                      >
                                        Save field
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setProjectFieldEditKey(null);
                                          setProjectFieldEditValue("");
                                        }}
                                      >
                                        Cancel
                                      </button>
                                      {fieldEditDisabledReason && (
                                        <small className="action-disabled-note">
                                          {fieldEditDisabledReason}
                                        </small>
                                      )}
                                    </form>
                                  ) : (
                                    <>
                                      <span className="state-chip">
                                        {fieldLabel}: {String(fieldDisplayValue)}
                                      </span>
                                      <button
                                        type="button"
                                        disabled={Boolean(fieldEditDisabledReason) || !fieldValue.editable}
                                        title={
                                          !fieldValue.editable
                                            ? "This project field value is read-only in Control."
                                            : (fieldEditDisabledReason ?? undefined)
                                        }
                                        onClick={() => beginEditingProjectField(item.id, fieldValue)}
                                      >
                                        Edit field
                                      </button>
                                    </>
                                  )}
                                </div>
                              );
                            })}
                            {item.fieldValuesTruncated && (
                              <small className="action-disabled-note">
                                Some project field values are not shown.
                              </small>
                            )}
                          </div>
                        )}
                        <button
                          type="button"
                          disabled={!item.htmlUrl}
                          title={
                            item.htmlUrl ? "Open project item on GitHub" : "Project item URL unavailable."
                          }
                          onClick={() => {
                            if (item.htmlUrl) {
                              onOpenExternal(item.htmlUrl);
                            }
                          }}
                        >
                          <ExternalLink size={15} /> Open
                        </button>
                        <button
                          type="button"
                          disabled={Boolean(projectDeleteItemDisabledReason)}
                          title={projectDeleteItemDisabledReason ?? undefined}
                          onClick={() =>
                            submitProjectMutation("deleteProjectV2Item", true, {
                              projectId: selectedProject.id,
                              itemId: item.id
                            })
                          }
                        >
                          Remove item
                        </button>
                      </article>
                    ))
                  ) : (
                    <div className="empty-state">No project items returned.</div>
                  )}
                  {selectedProject.itemsTruncated && (
                    <small className="action-disabled-note">
                      Showing the first {formatCompactNumber(selectedProject.items.length)} of{" "}
                      {selectedProject.itemsCount === null
                        ? "the returned"
                        : formatCompactNumber(selectedProject.itemsCount)}{" "}
                      project items.
                    </small>
                  )}
                </div>
              </section>
              <div className="thread-actions">
                <button
                  type="button"
                  disabled={Boolean(projectEditDisabledReason)}
                  title={projectEditDisabledReason ?? undefined}
                  onClick={() => beginEditingProject(selectedProject)}
                >
                  <SquareKanban size={16} /> Edit project
                </button>
                <button
                  type="button"
                  disabled={Boolean(projectDeleteDisabledReason)}
                  title={projectDeleteDisabledReason ?? undefined}
                  onClick={() =>
                    submitProjectMutation("deleteProjectV2", true, { projectId: selectedProject.id })
                  }
                >
                  <X size={16} /> Delete project
                </button>
                <button
                  type="button"
                  disabled={Boolean(projectExternalReason)}
                  title={projectExternalReason ?? undefined}
                  onClick={() => {
                    if (selectedProject.htmlUrl) {
                      onOpenExternal(selectedProject.htmlUrl);
                    }
                  }}
                >
                  <ExternalLink size={16} /> Project GitHub fallback
                </button>
                <button
                  type="button"
                  disabled={Boolean(ownerExternalReason)}
                  title={ownerExternalReason ?? undefined}
                  onClick={() => {
                    if (selectedProject.ownerHtmlUrl) {
                      onOpenExternal(selectedProject.ownerHtmlUrl);
                    }
                  }}
                >
                  <ExternalLink size={16} /> Owner GitHub fallback
                </button>
                {(projectExternalReason || ownerExternalReason) && (
                  <small className="action-disabled-note">
                    {[projectExternalReason, ownerExternalReason].filter(Boolean).join(" ")}
                  </small>
                )}
              </div>
              <form
                className="compose-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (projectAddItemDisabledReason || !selectedProjectItem) {
                    return;
                  }
                  submitProjectMutation("addProjectV2Item", false, {
                    projectId: selectedProject.id,
                    contentId: selectedProjectItem.id
                  });
                }}
              >
                <h2>Add issue or pull request</h2>
                {projectMutationStatusActive &&
                  submittedProjectAction === "addProjectV2Item" &&
                  mutationPending && <div className="loading-state">Adding project item…</div>}
                {projectMutationStatusActive &&
                  submittedProjectAction === "addProjectV2Item" &&
                  !mutationPending &&
                  mutationSucceeded && (
                    <div className="success-state">Project item added. Project data is refreshing.</div>
                  )}
                {projectMutationStatusActive &&
                  submittedProjectAction === "addProjectV2Item" &&
                  !mutationPending &&
                  mutationError && (
                    <div className="error-state">Add project item failed: {mutationError.message}</div>
                  )}
                <select
                  disabled={Boolean(projectAddItemDisabledReason)}
                  title={projectAddItemDisabledReason ?? undefined}
                  value={selectedProjectItem?.id ?? ""}
                  onChange={(event) => setProjectItemContentId(event.target.value)}
                >
                  {projectItemOptions.length === 0 ? (
                    <option value="">No loaded issue or pull request node IDs</option>
                  ) : (
                    projectItemOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label} · {item.state}
                      </option>
                    ))
                  )}
                </select>
                <div className="thread-actions">
                  <button
                    type="submit"
                    disabled={Boolean(projectAddItemDisabledReason)}
                    title={projectAddItemDisabledReason ?? undefined}
                  >
                    <Plus size={16} /> Add to project
                  </button>
                </div>
                {projectAddItemDisabledReason && (
                  <small className="action-disabled-note">{projectAddItemDisabledReason}</small>
                )}
                <small className="action-disabled-note">
                  Field edits support text, number, date, and single-select values returned by GitHub.
                </small>
              </form>
              {projectMutationStatusActive &&
                submittedProjectAction !== "addProjectV2Item" &&
                !projectFormMode &&
                mutationPending && (
                  <div className="loading-state">
                    {githubActionLabel(submittedProjectAction)} is running. Project data will refresh after
                    GitHub responds.
                  </div>
                )}
              {projectMutationStatusActive &&
                submittedProjectAction !== "addProjectV2Item" &&
                !projectFormMode &&
                !mutationPending &&
                mutationSucceeded && (
                  <div className="success-state">
                    {githubActionLabel(submittedProjectAction)} completed. Project data is refreshing.
                  </div>
                )}
              {projectMutationStatusActive &&
                submittedProjectAction !== "addProjectV2Item" &&
                !projectFormMode &&
                !mutationPending &&
                mutationError && (
                  <div className="error-state">
                    {githubActionLabel(submittedProjectAction)} failed: {mutationError.message}
                  </div>
                )}
            </>
          ) : (
            <div className="empty-state">
              {loading ? "Loading project detail…" : "Select a project to inspect."}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
