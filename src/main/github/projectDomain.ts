import type {
  GitHubReadAvailability,
  OrganizationProjectsInput,
  ProjectListResult,
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
    return this.fetchProjects(input);
  }

  async listProjectsWithStatus(input: ProjectsInput): Promise<ProjectListResult> {
    try {
      return {
        items: await this.fetchProjects(input),
        availability: { status: "available", message: null }
      };
    } catch (error: unknown) {
      return {
        items: [],
        availability: this.mapError(error)
      };
    }
  }

  async listOrganizationProjectsWithStatus(input: OrganizationProjectsInput): Promise<ProjectListResult> {
    try {
      const limit = input.limit ?? 20;
      const data = await this.client.graphql<{
        organization: {
          projectsV2: {
            nodes: GitHubProjectV2Node[];
          };
        } | null;
      }>(
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

      return {
        items: data.organization?.projectsV2.nodes.map(mapProjectV2) ?? [],
        availability: { status: "available", message: null }
      };
    } catch (error: unknown) {
      return {
        items: [],
        availability: this.mapError(error)
      };
    }
  }

  private async fetchProjects(input: ProjectsInput): Promise<ProjectSummary[]> {
    const limit = input.limit ?? 20;
    const data = await this.client.graphql<{
      repository: {
        projectsV2: {
          nodes: GitHubProjectV2Node[];
        };
      };
    }>(
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

    return data.repository.projectsV2.nodes.map(mapProjectV2);
  }
}

function mapProjectV2(project: GitHubProjectV2Node): ProjectSummary {
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
    htmlUrl: project.url
  };
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

export interface GitHubProjectV2Node {
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
