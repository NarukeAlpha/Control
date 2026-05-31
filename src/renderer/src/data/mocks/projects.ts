import type { ProjectSummary } from "@shared/github";

export const mockProjects: ProjectSummary[] = [
  {
    id: "P_1",
    number: 1,
    title: "Compiler quality",
    shortDescription: "Tracks compiler reliability work across active milestones.",
    readme: "## Focus\n\nCompiler correctness, crash triage, and high-priority diagnostics.",
    ownerLogin: "apple/swift",
    ownerKind: "repository",
    ownerHtmlUrl: "https://github.com/apple/swift",
    isPublic: false,
    closed: false,
    closedAt: null,
    createdAt: new Date(Date.now() - 14 * 86_400_000).toISOString(),
    updatedAt: new Date(Date.now() - 86_400_000).toISOString(),
    itemsCount: 48,
    items: [
      {
        id: "PVTI_1",
        type: "ISSUE",
        contentId: "I_agent",
        contentType: "Issue",
        title: "Reduce compiler crash regressions",
        body: "Track high-priority crash diagnostics.",
        number: 101,
        state: "OPEN",
        repositoryNameWithOwner: "apple/swift",
        htmlUrl: "https://github.com/apple/swift/issues/101",
        createdAt: new Date(Date.now() - 9 * 86_400_000).toISOString(),
        updatedAt: new Date(Date.now() - 86_400_000).toISOString(),
        fieldValues: [
          {
            id: "PVTFV_1",
            fieldId: "PF_1",
            fieldName: "Status",
            dataType: "SINGLE_SELECT",
            value: "In progress",
            optionId: "PFO_2",
            optionName: "In progress",
            options: [
              { id: "PFO_1", name: "Backlog" },
              { id: "PFO_2", name: "In progress" },
              { id: "PFO_3", name: "Done" }
            ],
            editable: true
          },
          {
            id: "PVTFV_2",
            fieldId: "PF_2",
            fieldName: "Priority",
            dataType: "SINGLE_SELECT",
            value: "High",
            optionId: "PFO_5",
            optionName: "High",
            options: [
              { id: "PFO_4", name: "Medium" },
              { id: "PFO_5", name: "High" }
            ],
            editable: true
          }
        ],
        fieldValuesTruncated: false
      },
      {
        id: "PVTI_2",
        type: "PULL_REQUEST",
        contentId: "PR_1",
        contentType: "PullRequest",
        title: "Improve type checker diagnostics",
        body: "Updates diagnostic presentation.",
        number: 202,
        state: "OPEN",
        repositoryNameWithOwner: "apple/swift",
        htmlUrl: "https://github.com/apple/swift/pull/202",
        createdAt: new Date(Date.now() - 6 * 86_400_000).toISOString(),
        updatedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
        fieldValues: [
          {
            id: "PVTFV_3",
            fieldId: "PF_3",
            fieldName: "Target",
            dataType: "TEXT",
            value: "5.10.1",
            optionId: null,
            optionName: null,
            options: [],
            editable: true
          }
        ],
        fieldValuesTruncated: false
      }
    ],
    itemsTruncated: true,
    fieldsCount: 7,
    fields: [
      {
        id: "PF_1",
        name: "Status",
        dataType: "SINGLE_SELECT",
        options: [
          { id: "PFO_1", name: "Backlog" },
          { id: "PFO_2", name: "In progress" },
          { id: "PFO_3", name: "Done" }
        ]
      },
      {
        id: "PF_2",
        name: "Priority",
        dataType: "SINGLE_SELECT",
        options: [
          { id: "PFO_4", name: "Medium" },
          { id: "PFO_5", name: "High" }
        ]
      },
      { id: "PF_3", name: "Target", dataType: "TEXT", options: [] }
    ],
    viewerCanUpdate: true,
    htmlUrl: "https://github.com/orgs/apple/projects/1"
  },
  {
    id: "P_2",
    number: 2,
    title: "Concurrency roadmap",
    shortDescription: "Planning board for concurrency migration and runtime follow-up.",
    readme: "## Scope\n\nTracks accepted proposals, implementation status, and migration blockers.",
    ownerLogin: "apple",
    ownerKind: "organization",
    ownerHtmlUrl: "https://github.com/apple",
    isPublic: true,
    closed: false,
    closedAt: null,
    createdAt: new Date(Date.now() - 28 * 86_400_000).toISOString(),
    updatedAt: new Date(Date.now() - 172_800_000).toISOString(),
    itemsCount: 31,
    items: [
      {
        id: "PVTI_3",
        type: "DRAFT_ISSUE",
        contentId: "DI_1",
        contentType: "DraftIssue",
        title: "Actor isolation migration notes",
        body: "Draft roadmap item for migration blockers.",
        number: null,
        state: "DRAFT_ISSUE",
        repositoryNameWithOwner: null,
        htmlUrl: null,
        createdAt: new Date(Date.now() - 12 * 86_400_000).toISOString(),
        updatedAt: new Date(Date.now() - 172_800_000).toISOString(),
        fieldValues: [
          {
            id: "PVTFV_4",
            fieldId: "PF_5",
            fieldName: "Release",
            dataType: "TEXT",
            value: "Swift 6",
            optionId: null,
            optionName: null,
            options: [],
            editable: true
          }
        ],
        fieldValuesTruncated: false
      }
    ],
    itemsTruncated: true,
    fieldsCount: 5,
    fields: [
      {
        id: "PF_4",
        name: "Status",
        dataType: "SINGLE_SELECT",
        options: [
          { id: "PFO_6", name: "Now" },
          { id: "PFO_7", name: "Next" }
        ]
      },
      { id: "PF_5", name: "Release", dataType: "TEXT", options: [] }
    ],
    viewerCanUpdate: false,
    htmlUrl: "https://github.com/orgs/apple/projects/2"
  }
];
