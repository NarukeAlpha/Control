import { ChevronDown, ExternalLink, Plus, Search, SquareKanban, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type JSX } from "react";

import type {
  GitHubAction,
  GitHubMutationFields,
  IssueSummary,
  ProjectFieldSummary,
  ProjectItemFieldValueSummary,
  ProjectItemSummary,
  ProjectSummary,
  PullRequestSummary,
  RepositoryDetail
} from "@shared/github";

import { MarkdownBody, markdownProjectUrlContext } from "@renderer/components/MarkdownBody";

import {
  githubActionLabel,
  readAvailabilityMessage,
  repositoryMutationDisabledReason,
  repositoryPath
} from "@renderer/components/repository/repositoryUi";

import { formatCompactNumber, formatRelativeDate } from "@renderer/utils/format";
import { useIssuesTabQueries } from "../issues/IssuesTab.queries";
import { usePullRequestsTabQueries } from "../pull-requests/PullRequestsTab.queries";
import { useProjectsTabQueries } from "./ProjectsTab.queries";

const maxProjectsLimit = 100;

type ProjectFormMode = "create" | "edit";

interface ProjectsTabProps {
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
}

interface ProjectItemOption {
  id: string;
  label: string;
  state: string;
}

interface ProjectFormSubmitInput {
  title: string;
  shortDescription: string | null;
  readme: string;
}

interface ProjectFieldEditContext {
  project: ProjectSummary | null;
  fieldValue: ProjectItemFieldValueSummary;
  editValue: string;
  projectActionPendingReason: string | null;
  selectedProjectMutationDisabledReason: string | null;
}

function buildProjectItemOptions(
  issueItems: IssueSummary[],
  pullItems: PullRequestSummary[]
): ProjectItemOption[] {
  const options: ProjectItemOption[] = [];

  for (const issue of issueItems) {
    if (issue.nodeId) {
      options.push({
        id: issue.nodeId,
        label: `Issue #${issue.number}: ${issue.title}`,
        state: issue.state
      });
    }
  }

  for (const pull of pullItems) {
    if (pull.nodeId) {
      options.push({
        id: pull.nodeId,
        label: `PR #${pull.number}: ${pull.title}`,
        state: pull.merged ? "merged" : pull.state
      });
    }
  }

  return options;
}

function projectMatchesFilter(project: ProjectSummary, normalizedFilter: string): boolean {
  const searchableValues: Array<string | number | null | undefined> = [
    project.title,
    project.shortDescription,
    project.readme,
    project.ownerLogin,
    project.number ? `#${project.number}` : null,
    project.closed ? "closed" : "open",
    project.isPublic === null ? null : project.isPublic ? "public" : "private"
  ];

  for (const item of project.items) {
    searchableValues.push(
      item.title,
      item.contentType,
      item.state,
      item.repositoryNameWithOwner,
      item.number
    );
  }

  for (const field of project.fields) {
    searchableValues.push(`${field.name} ${field.dataType ?? ""}`);
  }

  return searchableValues.some((value) =>
    String(value ?? "")
      .toLowerCase()
      .includes(normalizedFilter)
  );
}

function filterProjects(projects: ProjectSummary[], filter: string): ProjectSummary[] {
  const normalizedFilter = filter.trim().toLowerCase();
  if (!normalizedFilter) {
    return projects;
  }

  return projects.filter((project) => projectMatchesFilter(project, normalizedFilter));
}

function projectFieldForValue(
  project: ProjectSummary | null,
  fieldValue: ProjectItemFieldValueSummary
): ProjectFieldSummary | null {
  return project?.fields.find((field) => field.id === fieldValue.fieldId) ?? null;
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

function projectFieldEditDisabledReasonFor({
  project,
  fieldValue,
  editValue,
  projectActionPendingReason,
  selectedProjectMutationDisabledReason
}: ProjectFieldEditContext): string | null {
  const field = projectFieldForValue(project, fieldValue);
  const fieldOptions = field?.options ?? fieldValue.options;
  const normalizedValue = editValue.trim();

  return (
    projectActionPendingReason ??
    selectedProjectMutationDisabledReason ??
    (!fieldValue.editable ? "This field value is read-only in Control." : null) ??
    (!fieldValue.fieldId ? "GitHub did not return a field ID for this value." : null) ??
    (!project ? "Select a project first." : null) ??
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
    (fieldValue.dataType === "SINGLE_SELECT" && !normalizedValue ? "Choose a single-select option." : null) ??
    (String(fieldValue.optionId ?? fieldValue.value ?? "") === editValue
      ? "No field value changes to save."
      : null)
  );
}

function projectFieldMutationValue(
  fieldValue: ProjectItemFieldValueSummary,
  editValue: string
): NonNullable<GitHubMutationFields["value"]> {
  const normalizedValue = editValue.trim();
  if (fieldValue.dataType === "NUMBER") {
    return { number: Number(normalizedValue) };
  }
  if (fieldValue.dataType === "DATE") {
    return { date: normalizedValue };
  }
  if (fieldValue.dataType === "SINGLE_SELECT") {
    return { singleSelectOptionId: normalizedValue };
  }
  return { text: editValue };
}

function ProjectMutationStatus({
  active,
  action,
  mutationPending,
  mutationSucceeded,
  mutationError,
  runningMessage,
  successMessage,
  errorPrefix
}: {
  active: boolean;
  action: GitHubAction | null;
  mutationPending: boolean;
  mutationSucceeded: boolean;
  mutationError: Error | null;
  runningMessage: string;
  successMessage?: string;
  errorPrefix?: string;
}): JSX.Element | null {
  if (!active || !action) {
    return null;
  }

  if (mutationPending) {
    return <div className="loading-state">{runningMessage}</div>;
  }

  if (mutationSucceeded) {
    return (
      <div className="success-state">
        {successMessage ?? `${githubActionLabel(action)} completed. Project data is refreshing.`}
      </div>
    );
  }

  if (mutationError) {
    return (
      <div className="error-state">
        {errorPrefix ?? `${githubActionLabel(action)} failed`}: {mutationError.message}
      </div>
    );
  }

  return null;
}

function ProjectsToolbar({
  disabledReason,
  filter,
  onCreateProject,
  onFilterChange,
  onOpenProjectsFallback
}: {
  disabledReason: string | null;
  filter: string;
  onCreateProject(): void;
  onFilterChange(value: string): void;
  onOpenProjectsFallback(): void;
}): JSX.Element {
  function handleFilterChange(event: ChangeEvent<HTMLInputElement>): void {
    onFilterChange(event.target.value);
  }

  return (
    <div className="table-action-row surface-filter-row">
      <label className="surface-filter">
        <Search size={15} />
        <input
          aria-label="Filter projects"
          value={filter}
          onChange={handleFilterChange}
          placeholder="Filter projects"
        />
      </label>
      <button
        type="button"
        disabled={Boolean(disabledReason)}
        title={disabledReason ?? undefined}
        onClick={onCreateProject}
      >
        <Plus size={16} /> New project
      </button>
      <button type="button" onClick={onOpenProjectsFallback}>
        <ExternalLink size={16} /> Open on GitHub
      </button>
    </div>
  );
}

function ProjectListRow({
  active,
  project,
  onOpenExternal,
  onSelectProject
}: {
  active: boolean;
  project: ProjectSummary;
  onOpenExternal(url: string): void;
  onSelectProject(project: ProjectSummary): void;
}): JSX.Element {
  function handleSelectProject(): void {
    onSelectProject(project);
  }

  function handleOpenFallback(): void {
    if (project.htmlUrl) {
      onOpenExternal(project.htmlUrl);
    }
  }

  return (
    <div className={`issue-row thread-list-action-row ${active ? "active" : ""}`}>
      <button className="thread-list-row-main" type="button" onClick={handleSelectProject}>
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
              project.updatedAt ? `updated ${formatRelativeDate(project.updatedAt)}` : "no update timestamp"
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
        aria-label={`Open ${project.title} on GitHub`}
        disabled={!project.htmlUrl}
        title={project.htmlUrl ? `Open ${project.title} on GitHub` : "Project URL unavailable."}
        onClick={handleOpenFallback}
      >
        <ExternalLink size={15} />
      </button>
    </div>
  );
}

function ProjectList({
  availabilityMessage,
  canExpandProjects,
  disabledFeatureMessage,
  error,
  filter,
  filteredProjects,
  loading,
  projects,
  projectsLimitHit,
  selectedProject,
  onExpandProjects,
  onOpenExternal,
  onSelectProject
}: {
  availabilityMessage: string | null;
  canExpandProjects: boolean;
  disabledFeatureMessage: string | null;
  error: Error | null;
  filter: string;
  filteredProjects: ProjectSummary[];
  loading: boolean;
  projects: ProjectSummary[];
  projectsLimitHit: boolean;
  selectedProject: ProjectSummary | null;
  onExpandProjects(): void;
  onOpenExternal(url: string): void;
  onSelectProject(project: ProjectSummary): void;
}): JSX.Element {
  return (
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
        <ProjectListRow
          active={selectedProject?.id === project.id}
          key={project.id}
          project={project}
          onOpenExternal={onOpenExternal}
          onSelectProject={onSelectProject}
        />
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
  );
}

function ProjectForm({
  controlDisabledReason,
  mode,
  mutationAction,
  mutationError,
  mutationPending,
  mutationSucceeded,
  projectReadme,
  projectShortDescription,
  projectTitle,
  submitDisabledReason,
  submittedProjectAction,
  onCancel,
  onProjectReadmeChange,
  onProjectShortDescriptionChange,
  onProjectTitleChange,
  onSubmit
}: {
  controlDisabledReason: string | null;
  mode: ProjectFormMode;
  mutationAction: GitHubAction | null;
  mutationError: Error | null;
  mutationPending: boolean;
  mutationSucceeded: boolean;
  projectReadme: string;
  projectShortDescription: string;
  projectTitle: string;
  submitDisabledReason: string | null;
  submittedProjectAction: GitHubAction | null;
  onCancel(): void;
  onProjectReadmeChange(value: string): void;
  onProjectShortDescriptionChange(value: string): void;
  onProjectTitleChange(value: string): void;
  onSubmit(input: ProjectFormSubmitInput): void;
}): JSX.Element {
  const formAction: GitHubAction = mode === "create" ? "createProjectV2" : "updateProjectV2";
  const mutationActive = submittedProjectAction === formAction && mutationAction === formAction;

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (submitDisabledReason) {
      return;
    }

    onSubmit({
      title: projectTitle.trim(),
      shortDescription: projectShortDescription.trim() || null,
      readme: projectReadme
    });
  }

  function handleProjectTitleChange(event: ChangeEvent<HTMLInputElement>): void {
    onProjectTitleChange(event.target.value);
  }

  function handleProjectShortDescriptionChange(event: ChangeEvent<HTMLInputElement>): void {
    onProjectShortDescriptionChange(event.target.value);
  }

  function handleProjectReadmeChange(event: ChangeEvent<HTMLTextAreaElement>): void {
    onProjectReadmeChange(event.target.value);
  }

  return (
    <form className="compose-form" onSubmit={handleSubmit}>
      <h2>{mode === "create" ? "Create project" : "Edit project"}</h2>
      <ProjectMutationStatus
        active={mutationActive}
        action={formAction}
        mutationError={mutationError}
        mutationPending={mutationPending}
        mutationSucceeded={mutationSucceeded}
        runningMessage={`${githubActionLabel(formAction)} is running. The form is locked until GitHub responds.`}
      />
      <input
        disabled={Boolean(controlDisabledReason)}
        title={controlDisabledReason ?? undefined}
        value={projectTitle}
        onChange={handleProjectTitleChange}
        placeholder="Project title"
      />
      {mode === "edit" && (
        <>
          <input
            disabled={Boolean(controlDisabledReason)}
            title={controlDisabledReason ?? undefined}
            value={projectShortDescription}
            onChange={handleProjectShortDescriptionChange}
            placeholder="Short description"
          />
          <textarea
            disabled={Boolean(controlDisabledReason)}
            title={controlDisabledReason ?? undefined}
            value={projectReadme}
            onChange={handleProjectReadmeChange}
            placeholder="Project README"
          />
        </>
      )}
      <div className="thread-actions">
        <button
          type="submit"
          disabled={Boolean(submitDisabledReason)}
          title={submitDisabledReason ?? undefined}
        >
          <SquareKanban size={16} /> {mode === "create" ? "Create project" : "Save project"}
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
      {submitDisabledReason && <small className="action-disabled-note">{submitDisabledReason}</small>}
    </form>
  );
}

function ProjectFieldChips({ project }: { project: ProjectSummary }): JSX.Element {
  return (
    <div className="project-field-list" aria-label="Project fields">
      {project.fields.length > 0 ? (
        project.fields.map((field) => (
          <span className="state-chip" key={field.id}>
            {field.name}
            {field.dataType ? ` · ${field.dataType.toLowerCase().replaceAll("_", " ")}` : ""}
          </span>
        ))
      ) : (
        <span className="action-disabled-note">No project fields returned.</span>
      )}
    </div>
  );
}

function ProjectFieldValueRow({
  editValue,
  editing,
  fieldValue,
  itemId,
  project,
  projectActionPendingReason,
  selectedProjectMutationDisabledReason,
  onBeginEditingField,
  onCancelEditingField,
  onEditValueChange,
  onSubmitField
}: {
  editValue: string;
  editing: boolean;
  fieldValue: ProjectItemFieldValueSummary;
  itemId: string;
  project: ProjectSummary;
  projectActionPendingReason: string | null;
  selectedProjectMutationDisabledReason: string | null;
  onBeginEditingField(itemId: string, fieldValue: ProjectItemFieldValueSummary): void;
  onCancelEditingField(): void;
  onEditValueChange(value: string): void;
  onSubmitField(itemId: string, fieldValue: ProjectItemFieldValueSummary): void;
}): JSX.Element {
  const field = projectFieldForValue(project, fieldValue);
  const fieldOptions = field?.options ?? fieldValue.options;
  const fieldLabel = fieldValue.fieldName ?? "Project field";
  const fieldDisplayValue = fieldValue.optionName ?? fieldValue.value ?? "No value returned";
  const fieldEditDisabledReason = editing
    ? projectFieldEditDisabledReasonFor({
        project,
        fieldValue,
        editValue,
        projectActionPendingReason,
        selectedProjectMutationDisabledReason
      })
    : (projectActionPendingReason ?? selectedProjectMutationDisabledReason);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (fieldEditDisabledReason) {
      return;
    }
    onSubmitField(itemId, fieldValue);
  }

  function handleBeginEditingField(): void {
    onBeginEditingField(itemId, fieldValue);
  }

  function handleEditValueChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>): void {
    onEditValueChange(event.target.value);
  }

  return (
    <div className="project-field-value-row">
      {editing ? (
        <form className="repository-admin-form repository-admin-inline-form" onSubmit={handleSubmit}>
          <label>
            {fieldLabel}
            {fieldValue.dataType === "SINGLE_SELECT" ? (
              <select
                value={editValue}
                disabled={Boolean(projectActionPendingReason)}
                title={projectActionPendingReason ?? undefined}
                onChange={handleEditValueChange}
              >
                {!editValue && <option value="">Choose option</option>}
                {fieldOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={projectFieldEditInputType(fieldValue)}
                value={editValue}
                disabled={Boolean(projectActionPendingReason)}
                title={projectActionPendingReason ?? undefined}
                onChange={handleEditValueChange}
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
          <button type="button" onClick={onCancelEditingField}>
            Cancel
          </button>
          {fieldEditDisabledReason && (
            <small className="action-disabled-note">{fieldEditDisabledReason}</small>
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
            onClick={handleBeginEditingField}
          >
            Edit field
          </button>
        </>
      )}
    </div>
  );
}

function ProjectItemRow({
  deleteItemDisabledReason,
  editValue,
  fieldEditKey,
  item,
  project,
  projectActionPendingReason,
  selectedProjectMutationDisabledReason,
  onBeginEditingField,
  onCancelEditingField,
  onDeleteItem,
  onEditValueChange,
  onOpenExternal,
  onSubmitField
}: {
  deleteItemDisabledReason: string | null;
  editValue: string;
  fieldEditKey: string | null;
  item: ProjectItemSummary;
  project: ProjectSummary;
  projectActionPendingReason: string | null;
  selectedProjectMutationDisabledReason: string | null;
  onBeginEditingField(itemId: string, fieldValue: ProjectItemFieldValueSummary): void;
  onCancelEditingField(): void;
  onDeleteItem(item: ProjectItemSummary): void;
  onEditValueChange(value: string): void;
  onOpenExternal(url: string): void;
  onSubmitField(itemId: string, fieldValue: ProjectItemFieldValueSummary): void;
}): JSX.Element {
  function handleOpenItem(): void {
    if (item.htmlUrl) {
      onOpenExternal(item.htmlUrl);
    }
  }

  function handleDeleteItem(): void {
    onDeleteItem(item);
  }

  return (
    <article className="workflow-artifact-row">
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

            return (
              <ProjectFieldValueRow
                editValue={editValue}
                editing={fieldEditKey === editKey}
                fieldValue={fieldValue}
                itemId={item.id}
                key={fieldValue.id}
                project={project}
                projectActionPendingReason={projectActionPendingReason}
                selectedProjectMutationDisabledReason={selectedProjectMutationDisabledReason}
                onBeginEditingField={onBeginEditingField}
                onCancelEditingField={onCancelEditingField}
                onEditValueChange={onEditValueChange}
                onSubmitField={onSubmitField}
              />
            );
          })}
          {item.fieldValuesTruncated && (
            <small className="action-disabled-note">Some project field values are not shown.</small>
          )}
        </div>
      )}
      <button
        type="button"
        disabled={!item.htmlUrl}
        title={item.htmlUrl ? "Open project item on GitHub" : "Project item URL unavailable."}
        onClick={handleOpenItem}
      >
        <ExternalLink size={15} /> Open
      </button>
      <button
        type="button"
        disabled={Boolean(deleteItemDisabledReason)}
        title={deleteItemDisabledReason ?? undefined}
        onClick={handleDeleteItem}
      >
        Remove item
      </button>
    </article>
  );
}

function ProjectItemsPanel({
  deleteItemDisabledReason,
  editValue,
  fieldEditKey,
  project,
  projectActionPendingReason,
  selectedProjectMutationDisabledReason,
  onBeginEditingField,
  onCancelEditingField,
  onDeleteItem,
  onEditValueChange,
  onOpenExternal,
  onSubmitField
}: {
  deleteItemDisabledReason: string | null;
  editValue: string;
  fieldEditKey: string | null;
  project: ProjectSummary;
  projectActionPendingReason: string | null;
  selectedProjectMutationDisabledReason: string | null;
  onBeginEditingField(itemId: string, fieldValue: ProjectItemFieldValueSummary): void;
  onCancelEditingField(): void;
  onDeleteItem(item: ProjectItemSummary): void;
  onEditValueChange(value: string): void;
  onOpenExternal(url: string): void;
  onSubmitField(itemId: string, fieldValue: ProjectItemFieldValueSummary): void;
}): JSX.Element {
  return (
    <section className="workflow-detail-grid">
      <div>
        <h3>Project items</h3>
        {project.items.length > 0 ? (
          project.items.map((item) => (
            <ProjectItemRow
              deleteItemDisabledReason={deleteItemDisabledReason}
              editValue={editValue}
              fieldEditKey={fieldEditKey}
              item={item}
              key={item.id}
              project={project}
              projectActionPendingReason={projectActionPendingReason}
              selectedProjectMutationDisabledReason={selectedProjectMutationDisabledReason}
              onBeginEditingField={onBeginEditingField}
              onCancelEditingField={onCancelEditingField}
              onDeleteItem={onDeleteItem}
              onEditValueChange={onEditValueChange}
              onOpenExternal={onOpenExternal}
              onSubmitField={onSubmitField}
            />
          ))
        ) : (
          <div className="empty-state">No project items returned.</div>
        )}
        {project.itemsTruncated && (
          <small className="action-disabled-note">
            Showing the first {formatCompactNumber(project.items.length)} of{" "}
            {project.itemsCount === null ? "the returned" : formatCompactNumber(project.itemsCount)} project
            items.
          </small>
        )}
      </div>
    </section>
  );
}

function ProjectDetailActions({
  ownerExternalReason,
  project,
  projectDeleteDisabledReason,
  projectEditDisabledReason,
  projectExternalReason,
  onBeginEditingProject,
  onDeleteProject,
  onOpenExternal
}: {
  ownerExternalReason: string | null;
  project: ProjectSummary;
  projectDeleteDisabledReason: string | null;
  projectEditDisabledReason: string | null;
  projectExternalReason: string | null;
  onBeginEditingProject(project: ProjectSummary): void;
  onDeleteProject(project: ProjectSummary): void;
  onOpenExternal(url: string): void;
}): JSX.Element {
  function handleBeginEditingProject(): void {
    onBeginEditingProject(project);
  }

  function handleDeleteProject(): void {
    onDeleteProject(project);
  }

  function handleOpenProjectFallback(): void {
    if (project.htmlUrl) {
      onOpenExternal(project.htmlUrl);
    }
  }

  function handleOpenOwnerFallback(): void {
    if (project.ownerHtmlUrl) {
      onOpenExternal(project.ownerHtmlUrl);
    }
  }

  return (
    <div className="thread-actions">
      <button
        type="button"
        disabled={Boolean(projectEditDisabledReason)}
        title={projectEditDisabledReason ?? undefined}
        onClick={handleBeginEditingProject}
      >
        <SquareKanban size={16} /> Edit project
      </button>
      <button
        type="button"
        disabled={Boolean(projectDeleteDisabledReason)}
        title={projectDeleteDisabledReason ?? undefined}
        onClick={handleDeleteProject}
      >
        <X size={16} /> Delete project
      </button>
      <button
        type="button"
        disabled={Boolean(projectExternalReason)}
        title={projectExternalReason ?? undefined}
        onClick={handleOpenProjectFallback}
      >
        <ExternalLink size={16} /> Open project on GitHub
      </button>
      <button
        type="button"
        disabled={Boolean(ownerExternalReason)}
        title={ownerExternalReason ?? undefined}
        onClick={handleOpenOwnerFallback}
      >
        <ExternalLink size={16} /> Open owner on GitHub
      </button>
      {(projectExternalReason || ownerExternalReason) && (
        <small className="action-disabled-note">
          {[projectExternalReason, ownerExternalReason].filter(Boolean).join(" ")}
        </small>
      )}
    </div>
  );
}

function AddProjectItemForm({
  mutationAction,
  mutationError,
  mutationPending,
  mutationSucceeded,
  projectAddItemDisabledReason,
  projectItemOptions,
  projectItemOptionsRequested,
  selectedProjectItem,
  submittedProjectAction,
  onProjectItemContentIdChange,
  onRequestProjectItemOptions,
  onSubmitProjectItem
}: {
  mutationAction: GitHubAction | null;
  mutationError: Error | null;
  mutationPending: boolean;
  mutationSucceeded: boolean;
  projectAddItemDisabledReason: string | null;
  projectItemOptions: ProjectItemOption[];
  projectItemOptionsRequested: boolean;
  selectedProjectItem: ProjectItemOption | null;
  submittedProjectAction: GitHubAction | null;
  onProjectItemContentIdChange(value: string): void;
  onRequestProjectItemOptions(): void;
  onSubmitProjectItem(item: ProjectItemOption): void;
}): JSX.Element {
  const mutationActive =
    submittedProjectAction === "addProjectV2Item" && mutationAction === "addProjectV2Item";

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (projectAddItemDisabledReason || !selectedProjectItem) {
      return;
    }
    onSubmitProjectItem(selectedProjectItem);
  }

  function handleProjectItemChange(event: ChangeEvent<HTMLSelectElement>): void {
    onProjectItemContentIdChange(event.target.value);
  }

  return (
    <form className="compose-form" onSubmit={handleSubmit}>
      <h2>Add issue or pull request</h2>
      <ProjectMutationStatus
        active={mutationActive}
        action="addProjectV2Item"
        mutationError={mutationError}
        mutationPending={mutationPending}
        mutationSucceeded={mutationSucceeded}
        runningMessage="Adding project item…"
        successMessage="Project item added. Project data is refreshing."
        errorPrefix="Add project item failed"
      />
      {!projectItemOptionsRequested ? (
        <button type="button" onClick={onRequestProjectItemOptions}>
          Load issue and pull request options
        </button>
      ) : (
        <select
          disabled={Boolean(projectAddItemDisabledReason)}
          title={projectAddItemDisabledReason ?? undefined}
          value={selectedProjectItem?.id ?? ""}
          onChange={handleProjectItemChange}
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
      )}
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
  );
}

function ProjectDetail({
  editValue,
  fieldEditKey,
  mutationAction,
  mutationError,
  mutationPending,
  mutationSucceeded,
  ownerExternalReason,
  project,
  projectActionPendingReason,
  projectAddItemDisabledReason,
  projectDeleteDisabledReason,
  projectDeleteItemDisabledReason,
  projectEditDisabledReason,
  projectExternalReason,
  projectItemOptions,
  projectItemOptionsRequested,
  repository,
  selectedProjectItem,
  selectedProjectMutationDisabledReason,
  submittedProjectAction,
  onBeginEditingField,
  onBeginEditingProject,
  onCancelEditingField,
  onDeleteItem,
  onDeleteProject,
  onEditValueChange,
  onOpenExternal,
  onProjectItemContentIdChange,
  onRequestProjectItemOptions,
  onSubmitField,
  onSubmitProjectItem
}: {
  editValue: string;
  fieldEditKey: string | null;
  mutationAction: GitHubAction | null;
  mutationError: Error | null;
  mutationPending: boolean;
  mutationSucceeded: boolean;
  ownerExternalReason: string | null;
  project: ProjectSummary;
  projectActionPendingReason: string | null;
  projectAddItemDisabledReason: string | null;
  projectDeleteDisabledReason: string | null;
  projectDeleteItemDisabledReason: string | null;
  projectEditDisabledReason: string | null;
  projectExternalReason: string | null;
  projectItemOptions: ProjectItemOption[];
  projectItemOptionsRequested: boolean;
  repository: RepositoryDetail;
  selectedProjectItem: ProjectItemOption | null;
  selectedProjectMutationDisabledReason: string | null;
  submittedProjectAction: GitHubAction | null;
  onBeginEditingField(itemId: string, fieldValue: ProjectItemFieldValueSummary): void;
  onBeginEditingProject(project: ProjectSummary): void;
  onCancelEditingField(): void;
  onDeleteItem(item: ProjectItemSummary): void;
  onDeleteProject(project: ProjectSummary): void;
  onEditValueChange(value: string): void;
  onOpenExternal(url: string): void;
  onProjectItemContentIdChange(value: string): void;
  onRequestProjectItemOptions(): void;
  onSubmitField(itemId: string, fieldValue: ProjectItemFieldValueSummary): void;
  onSubmitProjectItem(item: ProjectItemOption): void;
}): JSX.Element {
  const detailMutationActive =
    submittedProjectAction !== null &&
    submittedProjectAction !== "addProjectV2Item" &&
    mutationAction === submittedProjectAction;

  return (
    <>
      <header className="thread-header">
        <h2>{project.title}</h2>
        <small>
          {[
            project.number ? `#${project.number}` : null,
            project.ownerLogin,
            project.createdAt ? `created ${formatRelativeDate(project.createdAt)}` : null,
            project.updatedAt ? `updated ${formatRelativeDate(project.updatedAt)}` : "no update timestamp"
          ]
            .filter(Boolean)
            .join(" · ")}
        </small>
        <span className={`state-chip ${project.closed ? "" : "success"}`}>
          {project.closed ? "closed" : "open"}
        </span>
      </header>
      <div className="workflow-summary">
        <span>
          {project.itemsCount === null
            ? "Items unavailable"
            : `${formatCompactNumber(project.itemsCount)} items`}
        </span>
        <span>
          {project.fieldsCount === null
            ? "Fields unavailable"
            : `${formatCompactNumber(project.fieldsCount)} fields`}
        </span>
        {project.isPublic !== null && <span>{project.isPublic ? "Public" : "Private"}</span>}
        {project.viewerCanUpdate !== null && (
          <span>{project.viewerCanUpdate ? "Viewer can update" : "Viewer read-only"}</span>
        )}
        <span>Managed in Control</span>
      </div>
      {project.shortDescription && <p className="project-description">{project.shortDescription}</p>}
      {project.readme ? (
        <div className="project-readme-panel">
          <MarkdownBody
            markdown={project.readme}
            onOpenExternal={onOpenExternal}
            urlContext={markdownProjectUrlContext(project, repository)}
          />
        </div>
      ) : (
        <div className="empty-state">No project README returned.</div>
      )}
      <ProjectFieldChips project={project} />
      <ProjectItemsPanel
        deleteItemDisabledReason={projectDeleteItemDisabledReason}
        editValue={editValue}
        fieldEditKey={fieldEditKey}
        project={project}
        projectActionPendingReason={projectActionPendingReason}
        selectedProjectMutationDisabledReason={selectedProjectMutationDisabledReason}
        onBeginEditingField={onBeginEditingField}
        onCancelEditingField={onCancelEditingField}
        onDeleteItem={onDeleteItem}
        onEditValueChange={onEditValueChange}
        onOpenExternal={onOpenExternal}
        onSubmitField={onSubmitField}
      />
      <ProjectDetailActions
        ownerExternalReason={ownerExternalReason}
        project={project}
        projectDeleteDisabledReason={projectDeleteDisabledReason}
        projectEditDisabledReason={projectEditDisabledReason}
        projectExternalReason={projectExternalReason}
        onBeginEditingProject={onBeginEditingProject}
        onDeleteProject={onDeleteProject}
        onOpenExternal={onOpenExternal}
      />
      <AddProjectItemForm
        mutationAction={mutationAction}
        mutationError={mutationError}
        mutationPending={mutationPending}
        mutationSucceeded={mutationSucceeded}
        projectAddItemDisabledReason={projectAddItemDisabledReason}
        projectItemOptions={projectItemOptions}
        projectItemOptionsRequested={projectItemOptionsRequested}
        selectedProjectItem={selectedProjectItem}
        submittedProjectAction={submittedProjectAction}
        onProjectItemContentIdChange={onProjectItemContentIdChange}
        onRequestProjectItemOptions={onRequestProjectItemOptions}
        onSubmitProjectItem={onSubmitProjectItem}
      />
      <ProjectMutationStatus
        active={detailMutationActive}
        action={submittedProjectAction}
        mutationError={mutationError}
        mutationPending={mutationPending}
        mutationSucceeded={mutationSucceeded}
        runningMessage={`${githubActionLabel(submittedProjectAction)} is running. Project data will refresh after GitHub responds.`}
      />
    </>
  );
}

function useFocusedProjectExpansion({
  canExpandProjects,
  focusedProjectId,
  focusedProjectLoaded,
  loading,
  onExpandProjects
}: {
  canExpandProjects: boolean;
  focusedProjectId: string | null;
  focusedProjectLoaded: boolean;
  loading: boolean;
  onExpandProjects(): void;
}): void {
  const expandedFocusedProjectId = useRef<string | null>(null);

  useEffect(() => {
    if (!focusedProjectId || focusedProjectLoaded || loading || !canExpandProjects) {
      return;
    }
    if (expandedFocusedProjectId.current === focusedProjectId) {
      return;
    }

    expandedFocusedProjectId.current = focusedProjectId;
    onExpandProjects();
  }, [canExpandProjects, focusedProjectId, focusedProjectLoaded, loading, onExpandProjects]);
}

function useProjectInteractionState(focusedProjectId: string | null) {
  const [filter, setFilter] = useState("");
  const [projectItemOptionsRequested, setProjectItemOptionsRequested] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(focusedProjectId);
  const [creatingProject, setCreatingProject] = useState(false);
  const [editingProject, setEditingProject] = useState(false);
  const [projectTitle, setProjectTitle] = useState("");
  const [projectShortDescription, setProjectShortDescription] = useState("");
  const [projectReadme, setProjectReadme] = useState("");
  const [projectItemContentId, setProjectItemContentId] = useState("");
  const [projectFieldEditKey, setProjectFieldEditKey] = useState<string | null>(null);
  const [projectFieldEditValue, setProjectFieldEditValue] = useState("");
  const [submittedProjectAction, setSubmittedProjectAction] = useState<GitHubAction | null>(null);

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

  function cancelProjectFieldEdit(): void {
    setProjectFieldEditKey(null);
    setProjectFieldEditValue("");
  }

  function cancelProjectForm(): void {
    setCreatingProject(false);
    setEditingProject(false);
    setSubmittedProjectAction(null);
  }

  function selectProject(project: ProjectSummary): void {
    setCreatingProject(false);
    setEditingProject(false);
    setSelectedProjectId(project.id);
  }

  return {
    filter,
    projectFieldEditKey,
    projectFieldEditValue,
    projectItemContentId,
    projectItemOptionsRequested,
    projectReadme,
    projectShortDescription,
    projectTitle,
    creatingProject,
    editingProject,
    selectedProjectId,
    submittedProjectAction,
    beginCreatingProject,
    beginEditingProject,
    beginEditingProjectField,
    cancelProjectFieldEdit,
    cancelProjectForm,
    selectProject,
    setFilter,
    setProjectFieldEditValue,
    setProjectItemContentId,
    setProjectItemOptionsRequested,
    setProjectReadme,
    setProjectShortDescription,
    setProjectTitle,
    setSubmittedProjectAction
  };
}

function useProjectsTabModel({
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
}: ProjectsTabProps) {
  const { projects: projectsQuery } = useProjectsTabQueries({
    owner: repository.owner,
    repo: repository.name,
    limit: projectsLimit,
    enabled: true,
    githubReady
  });
  const {
    filter,
    projectFieldEditKey,
    projectFieldEditValue,
    projectItemContentId,
    projectItemOptionsRequested,
    projectReadme,
    projectShortDescription,
    projectTitle,
    creatingProject,
    editingProject,
    selectedProjectId,
    submittedProjectAction,
    beginCreatingProject,
    beginEditingProject,
    beginEditingProjectField,
    cancelProjectFieldEdit,
    cancelProjectForm,
    selectProject: selectProjectState,
    setFilter,
    setProjectFieldEditValue,
    setProjectItemContentId,
    setProjectItemOptionsRequested,
    setProjectReadme,
    setProjectShortDescription,
    setProjectTitle,
    setSubmittedProjectAction
  } = useProjectInteractionState(focusedProjectId);
  const { issues } = useIssuesTabQueries({
    owner: repository.owner,
    repo: repository.name,
    issueListLimit: 100,
    issuesEnabled: projectItemOptionsRequested,
    resourcesEnabled: false,
    githubReady
  });
  const { pulls } = usePullRequestsTabQueries({
    owner: repository.owner,
    repo: repository.name,
    pullRequestListLimit: 100,
    pullsEnabled: projectItemOptionsRequested,
    resourcesEnabled: false,
    githubReady
  });

  const projects = projectsQuery.data?.items ?? [];
  const availability = projectsQuery.data?.availability ?? null;
  const loading = projectsQuery.isLoading || projectsQuery.isFetching;
  const error = projectsQuery.error;
  const filteredProjects = filterProjects(projects, filter);
  const requestedProjectId = selectedProjectId ?? focusedProjectId;
  const selectedProject = requestedProjectId
    ? (filteredProjects.find((project) => project.id === requestedProjectId) ?? null)
    : (filteredProjects[0] ?? null);
  const projectExternalReason = selectedProject?.htmlUrl ? null : "External project URL unavailable.";
  const ownerExternalReason = selectedProject?.ownerHtmlUrl ? null : "Project owner URL unavailable.";
  const availabilityMessage = readAvailabilityMessage("Projects", availability);
  const disabledFeatureMessage =
    !availabilityMessage && repository.administration.features.projects === false
      ? "Projects are disabled for this repository."
      : null;
  const projectsLimitHit = projects.length >= projectsLimit;
  const canExpandProjects = !disabledFeatureMessage && projectsLimitHit && projectsLimit < maxProjectsLimit;
  const focusedProjectLoaded = focusedProjectId
    ? projects.some((project) => project.id === focusedProjectId)
    : true;
  const projectItemOptions = useMemo(
    () => buildProjectItemOptions(issues.data?.items ?? [], pulls.data?.items ?? []),
    [issues.data?.items, pulls.data?.items]
  );
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
  const projectFormMode: ProjectFormMode | null = creatingProject
    ? "create"
    : editingProject && selectedProject
      ? "edit"
      : null;
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
    (!projectItemOptionsRequested ? "Load issue and pull request options before adding an item." : null) ??
    (!selectedProjectItem ? "No loaded issue or pull request has a GitHub node ID." : null);
  const projectDeleteItemDisabledReason =
    projectActionPendingReason ??
    selectedProjectMutationDisabledReason ??
    (!selectedProject ? "Select a project first." : null);
  const projectFormControlDisabledReason = projectActionPendingReason ?? projectMutationDisabledReason;

  useFocusedProjectExpansion({
    canExpandProjects,
    focusedProjectId,
    focusedProjectLoaded,
    loading,
    onExpandProjects
  });

  function submitProjectMutation(
    action: GitHubAction,
    dangerous: boolean,
    payload?: GitHubMutationFields
  ): void {
    setSubmittedProjectAction(action);
    onMutate(action, dangerous, payload);
  }

  function openProjectsFallback(): void {
    onOpenExternal(repositoryPath(repository, "/projects"));
  }

  function requestProjectItemOptions(): void {
    setProjectItemOptionsRequested(true);
  }

  function selectProject(project: ProjectSummary): void {
    selectProjectState(project);
    onSelectProject(project);
  }

  function submitProjectForm(input: ProjectFormSubmitInput): void {
    if (projectFormMode === "create") {
      submitProjectMutation("createProjectV2", false, { title: input.title });
      return;
    }

    if (selectedProject) {
      submitProjectMutation("updateProjectV2", false, {
        projectId: selectedProject.id,
        title: input.title,
        shortDescription: input.shortDescription,
        readme: input.readme
      });
    }
  }

  function submitProjectFieldEdit(itemId: string, fieldValue: ProjectItemFieldValueSummary): void {
    const fieldEditDisabledReason = projectFieldEditDisabledReasonFor({
      project: selectedProject,
      fieldValue,
      editValue: projectFieldEditValue,
      projectActionPendingReason,
      selectedProjectMutationDisabledReason
    });
    if (fieldEditDisabledReason || !fieldValue.fieldId || !selectedProject) {
      return;
    }

    submitProjectMutation("updateProjectV2Item", false, {
      projectId: selectedProject.id,
      itemId,
      fieldId: fieldValue.fieldId,
      value: projectFieldMutationValue(fieldValue, projectFieldEditValue)
    });
  }

  function submitProjectItem(item: ProjectItemOption): void {
    if (!selectedProject) {
      return;
    }
    submitProjectMutation("addProjectV2Item", false, {
      projectId: selectedProject.id,
      contentId: item.id
    });
  }

  function deleteProjectItem(item: ProjectItemSummary): void {
    if (!selectedProject) {
      return;
    }
    submitProjectMutation("deleteProjectV2Item", true, {
      projectId: selectedProject.id,
      itemId: item.id
    });
  }

  function deleteProject(project: ProjectSummary): void {
    submitProjectMutation("deleteProjectV2", true, { projectId: project.id });
  }

  return {
    availabilityMessage,
    beginCreatingProject,
    beginEditingProject,
    beginEditingProjectField,
    cancelProjectFieldEdit,
    cancelProjectForm,
    canExpandProjects,
    deleteProject,
    deleteProjectItem,
    disabledFeatureMessage,
    error,
    filter,
    filteredProjects,
    focusedProjectId,
    loading,
    mutationError,
    mutationPending,
    mutationSucceeded,
    onExpandProjects,
    onOpenExternal,
    openProjectsFallback,
    ownerExternalReason,
    projectActionPendingReason,
    projectAddItemDisabledReason,
    projectDeleteDisabledReason,
    projectDeleteItemDisabledReason,
    projectEditDisabledReason,
    projectExternalReason,
    projectFieldEditKey,
    projectFieldEditValue,
    projectFormControlDisabledReason,
    projectFormMode,
    projectFormSubmitDisabledReason,
    projectItemOptions,
    projectItemOptionsRequested,
    projectMutationAction,
    projectMutationDisabledReason,
    projectReadme,
    projectShortDescription,
    projectTitle,
    projects,
    projectsLimitHit,
    repository,
    requestProjectItemOptions,
    selectProject,
    selectedProject,
    selectedProjectItem,
    selectedProjectMutationDisabledReason,
    setFilter,
    setProjectFieldEditValue,
    setProjectItemContentId,
    setProjectReadme,
    setProjectShortDescription,
    setProjectTitle,
    submitProjectFieldEdit,
    submitProjectForm,
    submitProjectItem,
    submittedProjectAction
  };
}

export function ProjectsTab(props: ProjectsTabProps): JSX.Element {
  const model = useProjectsTabModel(props);

  return (
    <section className="table-panel github-surface">
      <ProjectsToolbar
        disabledReason={model.projectActionPendingReason ?? model.projectMutationDisabledReason}
        filter={model.filter}
        onCreateProject={model.beginCreatingProject}
        onFilterChange={model.setFilter}
        onOpenProjectsFallback={model.openProjectsFallback}
      />
      <div className="github-split">
        <ProjectList
          availabilityMessage={model.availabilityMessage}
          canExpandProjects={model.canExpandProjects}
          disabledFeatureMessage={model.disabledFeatureMessage}
          error={model.error}
          filter={model.filter}
          filteredProjects={model.filteredProjects}
          loading={model.loading}
          projects={model.projects}
          projectsLimitHit={model.projectsLimitHit}
          selectedProject={model.selectedProject}
          onExpandProjects={model.onExpandProjects}
          onOpenExternal={model.onOpenExternal}
          onSelectProject={model.selectProject}
        />
        <div className="thread-detail">
          {model.projectFormMode ? (
            <ProjectForm
              controlDisabledReason={model.projectFormControlDisabledReason}
              mode={model.projectFormMode}
              mutationAction={model.projectMutationAction}
              mutationError={model.mutationError}
              mutationPending={model.mutationPending}
              mutationSucceeded={model.mutationSucceeded}
              projectReadme={model.projectReadme}
              projectShortDescription={model.projectShortDescription}
              projectTitle={model.projectTitle}
              submitDisabledReason={model.projectFormSubmitDisabledReason}
              submittedProjectAction={model.submittedProjectAction}
              onCancel={model.cancelProjectForm}
              onProjectReadmeChange={model.setProjectReadme}
              onProjectShortDescriptionChange={model.setProjectShortDescription}
              onProjectTitleChange={model.setProjectTitle}
              onSubmit={model.submitProjectForm}
            />
          ) : model.selectedProject ? (
            <ProjectDetail
              editValue={model.projectFieldEditValue}
              fieldEditKey={model.projectFieldEditKey}
              mutationAction={model.projectMutationAction}
              mutationError={model.mutationError}
              mutationPending={model.mutationPending}
              mutationSucceeded={model.mutationSucceeded}
              ownerExternalReason={model.ownerExternalReason}
              project={model.selectedProject}
              projectActionPendingReason={model.projectActionPendingReason}
              projectAddItemDisabledReason={model.projectAddItemDisabledReason}
              projectDeleteDisabledReason={model.projectDeleteDisabledReason}
              projectDeleteItemDisabledReason={model.projectDeleteItemDisabledReason}
              projectEditDisabledReason={model.projectEditDisabledReason}
              projectExternalReason={model.projectExternalReason}
              projectItemOptions={model.projectItemOptions}
              projectItemOptionsRequested={model.projectItemOptionsRequested}
              repository={model.repository}
              selectedProjectItem={model.selectedProjectItem}
              selectedProjectMutationDisabledReason={model.selectedProjectMutationDisabledReason}
              submittedProjectAction={model.submittedProjectAction}
              onBeginEditingField={model.beginEditingProjectField}
              onBeginEditingProject={model.beginEditingProject}
              onCancelEditingField={model.cancelProjectFieldEdit}
              onDeleteItem={model.deleteProjectItem}
              onDeleteProject={model.deleteProject}
              onEditValueChange={model.setProjectFieldEditValue}
              onOpenExternal={model.onOpenExternal}
              onProjectItemContentIdChange={model.setProjectItemContentId}
              onRequestProjectItemOptions={model.requestProjectItemOptions}
              onSubmitField={model.submitProjectFieldEdit}
              onSubmitProjectItem={model.submitProjectItem}
            />
          ) : (
            <div className="empty-state">
              {model.loading
                ? "Loading project detail…"
                : model.focusedProjectId
                  ? "Focused project is not loaded in this repository page yet."
                  : "Select a project to inspect."}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
