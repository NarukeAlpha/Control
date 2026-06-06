import type {
  GitHubReadAvailability,
  OrganizationProjectsInput,
  ProjectListResult,
  ProjectSectionAvailability,
  ProjectSummary,
  ProjectsInput
} from "@shared/github";

export interface OctokitProjectClient {
  graphql<T>(query: string, variables?: Record<string, string | number | boolean | null>): Promise<T>;
}

export class OctokitProjectDomain {
  constructor(
    private readonly client: OctokitProjectClient,
    private readonly mapError: (error: unknown) => GitHubReadAvailability
  ) {}

  async listProjects(input: ProjectsInput): Promise<ProjectSummary[]> {
    return (await this.fetchRepositoryProjectsResult(input)).items;
  }

  async listProjectsWithStatus(input: ProjectsInput): Promise<ProjectListResult> {
    return this.fetchRepositoryProjectsResult(input);
  }

  async listOrganizationProjectsWithStatus(input: OrganizationProjectsInput): Promise<ProjectListResult> {
    try {
      const data = await this.fetchOrganizationProjectsData(input);
      if (!data.organization?.projectsV2) {
        return unavailableProjectListResult("Organization projects", {
          status: "not_found",
          message: `GitHub did not return projects for organization ${input.org}.`
        });
      }

      return mapProjectListResult("Organization projects", data.organization.projectsV2.nodes, []);
    } catch (error: unknown) {
      const partial = graphQLPartialDataFromError<OrganizationProjectsGraphQLData>(error);
      if (partial?.data.organization?.projectsV2) {
        return mapProjectListResult(
          "Organization projects",
          partial.data.organization.projectsV2.nodes,
          partial.errors
        );
      }

      return {
        items: [],
        availability: mapProjectGraphQLError(error, this.mapError)
      };
    }
  }

  private async fetchRepositoryProjectsResult(input: ProjectsInput): Promise<ProjectListResult> {
    try {
      const data = await this.fetchRepositoryProjectsData(input);
      if (!data.repository?.projectsV2) {
        return unavailableProjectListResult("Projects", {
          status: "not_found",
          message: `GitHub did not return projects for ${input.owner}/${input.repo}.`
        });
      }

      return mapProjectListResult("Projects", data.repository.projectsV2.nodes, []);
    } catch (error: unknown) {
      const partial = graphQLPartialDataFromError<RepositoryProjectsGraphQLData>(error);
      if (partial?.data.repository?.projectsV2) {
        return mapProjectListResult("Projects", partial.data.repository.projectsV2.nodes, partial.errors);
      }

      return {
        items: [],
        availability: mapProjectGraphQLError(error, this.mapError)
      };
    }
  }

  private async fetchRepositoryProjectsData(input: ProjectsInput): Promise<RepositoryProjectsGraphQLData> {
    const limit = input.limit ?? 20;
    return this.client.graphql<RepositoryProjectsGraphQLData>(
      `
      query RepositoryProjects($owner: String!, $repo: String!, $limit: Int!) {
        repository(owner: $owner, name: $repo) {
          projectsV2(first: $limit, orderBy: { field: UPDATED_AT, direction: DESC }) {
            nodes {
              id
              number
              title
              shortDescription
              readme
              public
              closed
              closedAt
              createdAt
              updatedAt
              viewerCanUpdate
              url
              owner {
                __typename
                ... on Organization { login url }
                ... on User { login url }
                ... on Repository { nameWithOwner url }
              }
              items(first: 20) {
                totalCount
                nodes {
                  id
                  type
                  createdAt
                  updatedAt
                  fieldValues(first: 20) {
                    totalCount
                    nodes {
                      __typename
                      ... on ProjectV2ItemFieldValueCommon {
                        id
                        field { ...ProjectV2FieldMetadata }
                      }
                      ... on ProjectV2ItemFieldTextValue {
                        text
                      }
                      ... on ProjectV2ItemFieldNumberValue {
                        number
                      }
                      ... on ProjectV2ItemFieldDateValue {
                        date
                      }
                      ... on ProjectV2ItemFieldSingleSelectValue {
                        name
                        optionId
                      }
                      ... on ProjectV2ItemFieldIterationValue {
                        title
                      }
                    }
                  }
                  content {
                    __typename
                    ... on Issue {
                      id
                      number
                      title
                      url
                      state
                      body
                      repository { nameWithOwner }
                    }
                    ... on PullRequest {
                      id
                      number
                      title
                      url
                      state
                      merged
                      isDraft
                      body
                      repository { nameWithOwner }
                    }
                    ... on DraftIssue {
                      id
                      title
                      body
                      createdAt
                      updatedAt
                    }
                  }
                }
              }
              fields(first: 12) {
                totalCount
                nodes {
                  ...ProjectV2FieldMetadata
                }
              }
            }
          }
        }
      }

      fragment ProjectV2FieldMetadata on ProjectV2FieldConfiguration {
        ... on ProjectV2Field {
          id
          name
          dataType
        }
        ... on ProjectV2SingleSelectField {
          id
          name
          dataType
          options {
            id
            name
          }
        }
        ... on ProjectV2IterationField {
          id
          name
          dataType
        }
      }
    `,
      { owner: input.owner, repo: input.repo, limit }
    );
  }

  private async fetchOrganizationProjectsData(
    input: OrganizationProjectsInput
  ): Promise<OrganizationProjectsGraphQLData> {
    const limit = input.limit ?? 20;
    return this.client.graphql<OrganizationProjectsGraphQLData>(
      `
        query OrganizationProjects($org: String!, $limit: Int!) {
          organization(login: $org) {
            projectsV2(first: $limit, orderBy: { field: UPDATED_AT, direction: DESC }) {
              nodes {
                id
                number
                title
                shortDescription
                readme
                public
                closed
                closedAt
                createdAt
                updatedAt
                viewerCanUpdate
                url
                owner {
                  __typename
                  ... on Organization { login url }
                  ... on User { login url }
                  ... on Repository { nameWithOwner url }
                }
                items(first: 1) { totalCount }
                fields(first: 12) {
                  totalCount
                  nodes {
                    ... on ProjectV2FieldCommon {
                      id
                      name
                      dataType
                    }
                  }
                }
              }
            }
          }
        }
      `,
      { org: input.org, limit }
    );
  }
}

function mapProjectListResult(
  feature: string,
  projects: Array<GitHubProjectV2Node | null>,
  errors: GitHubGraphQLErrorPayload[]
): ProjectListResult {
  const items = projects.flatMap((project, index) =>
    project ? [mapProjectV2(project, projectSectionAvailability(index, errors))] : []
  );

  return {
    items,
    availability: projectListAvailability(feature, errors)
  };
}

function unavailableProjectListResult(
  feature: string,
  availability: GitHubReadAvailability
): ProjectListResult {
  return {
    items: [],
    availability: {
      ...availability,
      message: availability.message ?? `${feature} unavailable.`
    }
  };
}

function mapProjectV2(
  project: GitHubProjectV2Node,
  sectionAvailability: ProjectSectionAvailability = availableProjectSectionAvailability()
): ProjectSummary {
  return {
    id: project.id,
    number: project.number ?? null,
    title: project.title,
    shortDescription: project.shortDescription ?? null,
    readme: project.readme ?? null,
    ...mapProjectV2Owner(project.owner),
    isPublic: project.public ?? null,
    closed: project.closed,
    closedAt: project.closedAt ?? null,
    createdAt: project.createdAt ?? null,
    updatedAt: project.updatedAt,
    itemsCount: project.items?.totalCount ?? null,
    items: (project.items?.nodes ?? [])
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .map(mapProjectV2Item),
    itemsTruncated: project.items ? project.items.totalCount > (project.items.nodes?.length ?? 0) : false,
    fieldsCount: project.fields?.totalCount ?? null,
    fields: (project.fields?.nodes ?? [])
      .filter((field): field is NonNullable<typeof field> => Boolean(field))
      .map(mapProjectV2Field),
    viewerCanUpdate: project.viewerCanUpdate ?? null,
    htmlUrl: project.url,
    sectionAvailability
  };
}

function availableProjectSectionAvailability(): ProjectSectionAvailability {
  return {
    readme: availableAvailability(),
    items: availableAvailability(),
    fields: availableAvailability()
  };
}

function availableAvailability(): GitHubReadAvailability {
  return { status: "available", message: null };
}

function projectListAvailability(
  feature: string,
  errors: GitHubGraphQLErrorPayload[]
): GitHubReadAvailability {
  if (errors.length === 0) {
    return availableAvailability();
  }

  return {
    status: "partial_data",
    message: `${feature} returned partial data from GitHub; showing projects and sections that were available.`
  };
}

function projectSectionAvailability(
  projectIndex: number,
  errors: GitHubGraphQLErrorPayload[]
): ProjectSectionAvailability {
  return {
    readme: mapProjectSectionAvailability(
      "Project README",
      errors.filter((error) => projectErrorMatchesSection(error, projectIndex, "readme"))
    ),
    items: mapProjectSectionAvailability(
      "Project items",
      errors.filter((error) => projectErrorMatchesSection(error, projectIndex, "items"))
    ),
    fields: mapProjectSectionAvailability(
      "Project fields",
      errors.filter((error) => projectErrorMatchesSection(error, projectIndex, "fields"))
    )
  };
}

function mapProjectSectionAvailability(
  sectionLabel: string,
  errors: GitHubGraphQLErrorPayload[]
): GitHubReadAvailability {
  if (errors.length === 0) {
    return availableAvailability();
  }

  const error = errors[0];
  const status = classifyProjectGraphQLError(error);
  const message = error.message
    ? `${sectionLabel} unavailable: ${error.message}`
    : `${sectionLabel} unavailable.`;

  return { status, message };
}

function mapProjectGraphQLError(
  error: unknown,
  mapError: (error: unknown) => GitHubReadAvailability
): GitHubReadAvailability {
  const errors = graphQLErrorsFrom(error);
  if (errors.length === 0) {
    return mapError(error);
  }

  const errorStatus = classifyProjectGraphQLError(errors[0]);
  return {
    status: errorStatus === "partial_data" ? "graphql_error" : errorStatus,
    message:
      errors
        .map((graphqlError) => graphqlError.message)
        .filter(Boolean)
        .join(" ") || null
  };
}

function classifyProjectGraphQLError(error: GitHubGraphQLErrorPayload): GitHubReadAvailability["status"] {
  const normalizedMessage = (error.message ?? "").toLowerCase();
  const normalizedType = (error.type ?? error.extensions?.code ?? "").toLowerCase();

  if (normalizedMessage.includes("rate limit") || normalizedMessage.includes("secondary rate")) {
    return "rate_limited";
  }

  if (
    normalizedType.includes("forbidden") ||
    normalizedType.includes("unauthorized") ||
    normalizedMessage.includes("permission") ||
    normalizedMessage.includes("resource not accessible") ||
    normalizedMessage.includes("forbidden")
  ) {
    return "permission_denied";
  }

  if (
    normalizedMessage.includes("not enabled") ||
    normalizedMessage.includes("disabled") ||
    normalizedMessage.includes("projects are disabled")
  ) {
    return "feature_disabled";
  }

  if (
    normalizedType.includes("not_found") ||
    normalizedMessage.includes("could not resolve to a node") ||
    normalizedMessage.includes("node was not found") ||
    normalizedMessage.includes("not found")
  ) {
    return "not_found";
  }

  if (
    normalizedMessage.includes("cannot query field") ||
    normalizedMessage.includes("doesn't exist on type") ||
    normalizedMessage.includes("does not exist on type")
  ) {
    return "missing_field";
  }

  if (normalizedMessage.includes("unsupported") || normalizedMessage.includes("fragment cannot be spread")) {
    return "unsupported_field";
  }

  return "partial_data";
}

function projectErrorMatchesSection(
  error: GitHubGraphQLErrorPayload,
  projectIndex: number,
  section: "readme" | "items" | "fields"
): boolean {
  const path = error.path ?? [];
  return projectIndexFromPath(path) === projectIndex && path.some((part) => part === section);
}

function projectIndexFromPath(path: Array<string | number>): number | null {
  const projectsIndex = path.findIndex((part) => part === "projectsV2");
  if (projectsIndex === -1) {
    return null;
  }

  for (let index = projectsIndex + 1; index < path.length - 1; index += 1) {
    const projectIndex = path[index + 1];
    if (path[index] === "nodes" && typeof projectIndex === "number") {
      return projectIndex;
    }
  }

  return null;
}

function graphQLPartialDataFromError<T>(
  error: unknown
): { data: T; errors: GitHubGraphQLErrorPayload[] } | null {
  const data = graphQLDataFromError<T>(error);
  const errors = graphQLErrorsFrom(error);

  if (!data || errors.length === 0) {
    return null;
  }

  return { data, errors };
}

function graphQLDataFromError<T>(error: unknown): T | null {
  const record = recordFromUnknown(error);
  const responseRecord = recordFromUnknown(record?.response);
  const responseDataRecord = recordFromUnknown(responseRecord?.data);
  const directData = record?.data;
  const nestedResponseData = responseDataRecord?.data;
  const responseData = responseDataRecord && !("errors" in responseDataRecord) ? responseDataRecord : null;
  const data = directData ?? nestedResponseData ?? responseData;

  return data && typeof data === "object" ? (data as T) : null;
}

function graphQLErrorsFrom(error: unknown): GitHubGraphQLErrorPayload[] {
  const record = recordFromUnknown(error);
  const responseRecord = recordFromUnknown(record?.response);
  const responseDataRecord = recordFromUnknown(responseRecord?.data);
  const errors = record?.errors ?? responseDataRecord?.errors;
  const fallbackMessage = error instanceof Error ? error.message : "GitHub GraphQL request failed.";

  return Array.isArray(errors)
    ? errors.map((graphqlError) => mapGitHubGraphQLErrorPayload(graphqlError, fallbackMessage))
    : [];
}

function mapGitHubGraphQLErrorPayload(error: unknown, fallbackMessage: string): GitHubGraphQLErrorPayload {
  const record = recordFromUnknown(error);
  const extensions = recordFromUnknown(record?.extensions);
  const path = Array.isArray(record?.path)
    ? record.path.filter(
        (part): part is string | number => typeof part === "string" || typeof part === "number"
      )
    : null;

  return {
    message: typeof record?.message === "string" ? record.message : fallbackMessage,
    type: typeof record?.type === "string" ? record.type : null,
    path,
    extensions: extensions
      ? {
          code: typeof extensions.code === "string" ? extensions.code : null
        }
      : null
  };
}

function recordFromUnknown(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function mapProjectV2Item(item: GitHubProjectV2ItemNode) {
  const content = item.content ?? null;
  const fallbackState = item.type ?? null;

  if (!content) {
    return {
      id: item.id,
      type: item.type ?? null,
      contentId: null,
      contentType: null,
      title: null,
      body: null,
      number: null,
      state: fallbackState,
      repositoryNameWithOwner: null,
      htmlUrl: null,
      createdAt: item.createdAt ?? null,
      updatedAt: item.updatedAt ?? null,
      fieldValues: mapProjectV2ItemFieldValues(item),
      fieldValuesTruncated: projectItemFieldValuesTruncated(item)
    };
  }

  if (content.__typename === "Issue") {
    return {
      id: item.id,
      type: item.type ?? null,
      contentId: content.id,
      contentType: "Issue",
      title: content.title,
      body: content.body ?? null,
      number: content.number ?? null,
      state: content.state ?? fallbackState,
      repositoryNameWithOwner: content.repository?.nameWithOwner ?? null,
      htmlUrl: content.url ?? null,
      createdAt: item.createdAt ?? null,
      updatedAt: item.updatedAt ?? null,
      fieldValues: mapProjectV2ItemFieldValues(item),
      fieldValuesTruncated: projectItemFieldValuesTruncated(item)
    };
  }

  if (content.__typename === "PullRequest") {
    return {
      id: item.id,
      type: item.type ?? null,
      contentId: content.id,
      contentType: "PullRequest",
      title: content.title,
      body: content.body ?? null,
      number: content.number ?? null,
      state: content.merged ? "MERGED" : content.isDraft ? "DRAFT" : (content.state ?? fallbackState),
      repositoryNameWithOwner: content.repository?.nameWithOwner ?? null,
      htmlUrl: content.url ?? null,
      createdAt: item.createdAt ?? null,
      updatedAt: item.updatedAt ?? null,
      fieldValues: mapProjectV2ItemFieldValues(item),
      fieldValuesTruncated: projectItemFieldValuesTruncated(item)
    };
  }

  if (content.__typename === "DraftIssue") {
    return {
      id: item.id,
      type: item.type ?? null,
      contentId: content.id,
      contentType: "DraftIssue",
      title: content.title,
      body: content.body ?? null,
      number: null,
      state: fallbackState,
      repositoryNameWithOwner: null,
      htmlUrl: null,
      createdAt: content.createdAt ?? item.createdAt ?? null,
      updatedAt: content.updatedAt ?? item.updatedAt ?? null,
      fieldValues: mapProjectV2ItemFieldValues(item),
      fieldValuesTruncated: projectItemFieldValuesTruncated(item)
    };
  }

  return {
    id: item.id,
    type: item.type ?? null,
    contentId: content.id ?? null,
    contentType: content.__typename,
    title: null,
    body: null,
    number: null,
    state: fallbackState,
    repositoryNameWithOwner: null,
    htmlUrl: null,
    createdAt: item.createdAt ?? null,
    updatedAt: item.updatedAt ?? null,
    fieldValues: mapProjectV2ItemFieldValues(item),
    fieldValuesTruncated: projectItemFieldValuesTruncated(item)
  };
}

function mapProjectV2Field(field: GitHubProjectV2FieldNode) {
  return {
    id: field.id,
    name: field.name,
    dataType: field.dataType ?? null,
    options: (field.options ?? []).map((option) => ({ id: option.id, name: option.name }))
  };
}

function projectItemFieldValuesTruncated(item: GitHubProjectV2ItemNode): boolean {
  return item.fieldValues ? item.fieldValues.totalCount > (item.fieldValues.nodes?.length ?? 0) : false;
}

function mapProjectV2ItemFieldValues(item: GitHubProjectV2ItemNode) {
  return (item.fieldValues?.nodes ?? [])
    .filter(
      (value): value is NonNullable<typeof value> & { id: string } =>
        value !== null && typeof value.id === "string"
    )
    .map((value) => {
      const field = value.field ?? null;
      const fieldMetadata = field ? mapProjectV2Field(field) : null;
      const base = {
        id: value.id,
        fieldId: fieldMetadata?.id ?? null,
        fieldName: fieldMetadata?.name ?? null,
        dataType: fieldMetadata?.dataType ?? null,
        optionId: null,
        optionName: null,
        options: fieldMetadata?.options ?? []
      };

      if (value.__typename === "ProjectV2ItemFieldTextValue") {
        return { ...base, value: value.text ?? null, editable: Boolean(fieldMetadata?.id) };
      }

      if (value.__typename === "ProjectV2ItemFieldNumberValue") {
        return { ...base, value: value.number ?? null, editable: Boolean(fieldMetadata?.id) };
      }

      if (value.__typename === "ProjectV2ItemFieldDateValue") {
        return { ...base, value: value.date ?? null, editable: Boolean(fieldMetadata?.id) };
      }

      if (value.__typename === "ProjectV2ItemFieldSingleSelectValue") {
        return {
          ...base,
          value: value.name ?? null,
          optionId: value.optionId ?? null,
          optionName: value.name ?? null,
          editable: Boolean(fieldMetadata?.id && value.optionId)
        };
      }

      if (value.__typename === "ProjectV2ItemFieldIterationValue") {
        return { ...base, value: value.title ?? null, editable: false };
      }

      return { ...base, value: null, editable: false };
    });
}

type ProjectV2OwnerSummary = Pick<ProjectSummary, "ownerLogin" | "ownerKind" | "ownerHtmlUrl">;

function mapProjectV2Owner(owner: GitHubProjectV2OwnerNode | null | undefined): ProjectV2OwnerSummary {
  if (!owner) {
    return mapUnknownProjectV2Owner();
  }

  if (isGitHubProjectV2RepositoryOwner(owner)) {
    return mapRepositoryProjectV2Owner(owner);
  }

  if (isGitHubProjectV2OrganizationOwner(owner)) {
    return mapOrganizationProjectV2Owner(owner);
  }

  if (isGitHubProjectV2UserOwner(owner)) {
    return mapUserProjectV2Owner(owner);
  }

  return mapUnknownProjectV2Owner();
}

function mapRepositoryProjectV2Owner(owner: GitHubProjectV2RepositoryOwnerNode): ProjectV2OwnerSummary {
  return {
    ownerLogin: owner.nameWithOwner ?? null,
    ownerKind: "repository",
    ownerHtmlUrl: owner.url ?? null
  };
}

function mapOrganizationProjectV2Owner(owner: GitHubProjectV2OrganizationOwnerNode): ProjectV2OwnerSummary {
  return {
    ownerLogin: owner.login ?? null,
    ownerKind: "organization",
    ownerHtmlUrl: owner.url ?? null
  };
}

function mapUserProjectV2Owner(owner: GitHubProjectV2UserOwnerNode): ProjectV2OwnerSummary {
  return {
    ownerLogin: owner.login ?? null,
    ownerKind: "user",
    ownerHtmlUrl: owner.url ?? null
  };
}

function mapUnknownProjectV2Owner(): ProjectV2OwnerSummary {
  return {
    ownerLogin: null,
    ownerKind: "unknown",
    ownerHtmlUrl: null
  };
}

function isGitHubProjectV2RepositoryOwner(
  owner: GitHubProjectV2OwnerNode
): owner is GitHubProjectV2RepositoryOwnerNode {
  return owner.__typename === "Repository";
}

function isGitHubProjectV2OrganizationOwner(
  owner: GitHubProjectV2OwnerNode
): owner is GitHubProjectV2OrganizationOwnerNode {
  return owner.__typename === "Organization";
}

function isGitHubProjectV2UserOwner(owner: GitHubProjectV2OwnerNode): owner is GitHubProjectV2UserOwnerNode {
  return owner.__typename === "User";
}

interface RepositoryProjectsGraphQLData {
  repository: {
    projectsV2: {
      nodes: Array<GitHubProjectV2Node | null>;
    };
  } | null;
}

interface OrganizationProjectsGraphQLData {
  organization: {
    projectsV2: {
      nodes: Array<GitHubProjectV2Node | null>;
    };
  } | null;
}

interface GitHubGraphQLErrorPayload {
  message: string;
  type: string | null;
  path: Array<string | number> | null;
  extensions: {
    code: string | null;
  } | null;
}

interface GitHubProjectV2Node {
  id: string;
  number?: number | null;
  title: string;
  shortDescription?: string | null;
  readme?: string | null;
  owner?: GitHubProjectV2OwnerNode | null;
  public?: boolean | null;
  closed: boolean;
  closedAt?: string | null;
  createdAt?: string | null;
  updatedAt: string | null;
  items?: {
    totalCount: number;
    nodes?: Array<GitHubProjectV2ItemNode | null>;
  } | null;
  fields?: {
    totalCount: number;
    nodes?: Array<GitHubProjectV2FieldNode | null>;
  } | null;
  viewerCanUpdate?: boolean | null;
  url: string | null;
}

interface GitHubProjectV2FieldNode {
  id: string;
  name: string;
  dataType?: string | null;
  options?: Array<{ id: string; name: string }>;
}

interface GitHubProjectV2ItemNode {
  id: string;
  type?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  content?: GitHubProjectV2ItemContentNode | null;
  fieldValues?: {
    totalCount: number;
    nodes?: Array<GitHubProjectV2ItemFieldValueNode | null>;
  } | null;
}

type GitHubProjectV2ItemFieldValueNode =
  | {
      __typename: "ProjectV2ItemFieldTextValue";
      id: string;
      text?: string | null;
      field?: GitHubProjectV2FieldNode | null;
    }
  | {
      __typename: "ProjectV2ItemFieldNumberValue";
      id: string;
      number?: number | null;
      field?: GitHubProjectV2FieldNode | null;
    }
  | {
      __typename: "ProjectV2ItemFieldDateValue";
      id: string;
      date?: string | null;
      field?: GitHubProjectV2FieldNode | null;
    }
  | {
      __typename: "ProjectV2ItemFieldSingleSelectValue";
      id: string;
      name?: string | null;
      optionId?: string | null;
      field?: GitHubProjectV2FieldNode | null;
    }
  | {
      __typename: "ProjectV2ItemFieldIterationValue";
      id: string;
      title?: string | null;
      field?: GitHubProjectV2FieldNode | null;
    }
  | {
      __typename:
        | "ProjectV2ItemFieldLabelValue"
        | "ProjectV2ItemFieldMilestoneValue"
        | "ProjectV2ItemFieldPullRequestValue"
        | "ProjectV2ItemFieldRepositoryValue"
        | "ProjectV2ItemFieldReviewerValue"
        | "ProjectV2ItemFieldUserValue"
        | "ProjectV2ItemIssueFieldValue";
      id?: string | null;
      field?: GitHubProjectV2FieldNode | null;
    };

type GitHubProjectV2ItemContentNode =
  | {
      __typename: "Issue";
      id: string;
      number?: number | null;
      title: string;
      url?: string | null;
      state?: string | null;
      body?: string | null;
      repository?: { nameWithOwner: string } | null;
    }
  | {
      __typename: "PullRequest";
      id: string;
      number?: number | null;
      title: string;
      url?: string | null;
      state?: string | null;
      merged?: boolean | null;
      isDraft?: boolean | null;
      body?: string | null;
      repository?: { nameWithOwner: string } | null;
    }
  | {
      __typename: "DraftIssue";
      id: string;
      title: string;
      body?: string | null;
      createdAt?: string | null;
      updatedAt?: string | null;
    }
  | {
      __typename: "Redacted";
      id?: string | null;
    };

type GitHubProjectV2OwnerNode =
  | GitHubProjectV2OrganizationOwnerNode
  | GitHubProjectV2UserOwnerNode
  | GitHubProjectV2RepositoryOwnerNode
  | GitHubProjectV2UnknownOwnerNode;

interface GitHubProjectV2OrganizationOwnerNode {
  __typename: "Organization";
  login?: string | null;
  url?: string | null;
}

interface GitHubProjectV2UserOwnerNode {
  __typename: "User";
  login?: string | null;
  url?: string | null;
}

interface GitHubProjectV2RepositoryOwnerNode {
  __typename: "Repository";
  nameWithOwner?: string | null;
  url?: string | null;
}

interface GitHubProjectV2UnknownOwnerNode {
  __typename: string;
}
