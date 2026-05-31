import type { GitHubMutationFields, GitHubMutationInput, GitHubMutationResult } from "@shared/github";

type GitHubMutationRuntimePayload = GitHubMutationInput & Partial<GitHubMutationFields>;

export interface OctokitMutationClient {
  graphql<T>(query: string, variables?: Record<string, string | number | boolean | null>): Promise<T>;
  rest<T>(route: string, params?: Record<string, unknown>): Promise<T>;
}

export class OctokitMutationDomain {
  constructor(private readonly client: OctokitMutationClient) {}

  async mutate<TInput extends GitHubMutationInput, TResult extends GitHubMutationResult>(
    input: TInput
  ): Promise<TResult> {
    const data = await this.performMutation(input);
    return {
      ok: true,
      action: input.action,
      message: `${input.action} completed.`,
      data
    } as TResult;
  }

  private async performMutation(input: GitHubMutationInput): Promise<unknown> {
    const { owner, repo } = input;
    const payload = input as GitHubMutationRuntimePayload;

    switch (input.action) {
      case "star":
        return this.client.rest("PUT /user/starred/{owner}/{repo}", { owner, repo });
      case "unstar":
        return this.client.rest("DELETE /user/starred/{owner}/{repo}", { owner, repo });
      case "watch":
        return this.client.rest("PUT /repos/{owner}/{repo}/subscription", {
          owner,
          repo,
          subscribed: true,
          ignored: false
        });
      case "unwatch":
        return this.client.rest("DELETE /repos/{owner}/{repo}/subscription", { owner, repo });
      case "fork":
        return this.client.rest("POST /repos/{owner}/{repo}/forks", { owner, repo });
      case "editRepository": {
        const repository = await this.client.rest("PATCH /repos/{owner}/{repo}", {
          owner,
          repo,
          ...pick(payload, [
            "description",
            "homepage",
            "default_branch",
            "archived",
            "has_issues",
            "has_projects",
            "has_wiki",
            "has_discussions",
            "allow_merge_commit",
            "allow_squash_merge",
            "allow_rebase_merge",
            "allow_auto_merge",
            "delete_branch_on_merge",
            "allow_update_branch",
            "allow_forking",
            "web_commit_signoff_required"
          ])
        });
        if (Array.isArray(payload.topics)) {
          const topics = await this.client.rest("PUT /repos/{owner}/{repo}/topics", {
            owner,
            repo,
            names: stringArray(payload.topics)
          });
          return { repository, topics };
        }
        return repository;
      }
      case "createIssue":
        return this.client.rest("POST /repos/{owner}/{repo}/issues", {
          owner,
          repo,
          ...pick(payload, ["title", "body", "labels", "assignees", "milestone"])
        });
      case "editIssue":
        return this.client.rest("PATCH /repos/{owner}/{repo}/issues/{issue_number}", {
          owner,
          repo,
          issue_number: getNumber(payload, "issueNumber"),
          ...pick(payload, ["title", "body", "state", "labels", "assignees", "milestone"])
        });
      case "closeIssue":
        return this.client.rest("PATCH /repos/{owner}/{repo}/issues/{issue_number}", {
          owner,
          repo,
          issue_number: getNumber(payload, "issueNumber"),
          state: "closed",
          state_reason: typeof payload.stateReason === "string" ? payload.stateReason : "completed"
        });
      case "reopenIssue":
        return this.client.rest("PATCH /repos/{owner}/{repo}/issues/{issue_number}", {
          owner,
          repo,
          issue_number: getNumber(payload, "issueNumber"),
          state: "open"
        });
      case "addComment":
        return this.client.rest("POST /repos/{owner}/{repo}/issues/{issue_number}/comments", {
          owner,
          repo,
          issue_number: getNumber(payload, "issueNumber"),
          ...pick(payload, ["body"])
        });
      case "editComment":
        return this.client.rest("PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}", {
          owner,
          repo,
          comment_id: getNumber(payload, "commentId"),
          ...pick(payload, ["body"])
        });
      case "deleteComment":
        return this.client.rest("DELETE /repos/{owner}/{repo}/issues/comments/{comment_id}", {
          owner,
          repo,
          comment_id: getNumber(payload, "commentId")
        });
      case "editReviewComment":
        return this.client.rest("PATCH /repos/{owner}/{repo}/pulls/comments/{comment_id}", {
          owner,
          repo,
          comment_id: getNumber(payload, "commentId"),
          ...pick(payload, ["body"])
        });
      case "deleteReviewComment":
        return this.client.rest("DELETE /repos/{owner}/{repo}/pulls/comments/{comment_id}", {
          owner,
          repo,
          comment_id: getNumber(payload, "commentId")
        });
      case "addLabels":
        return this.client.rest("POST /repos/{owner}/{repo}/issues/{issue_number}/labels", {
          owner,
          repo,
          issue_number: getNumber(payload, "issueNumber"),
          ...pick(payload, ["labels"])
        });
      case "removeLabel":
        return this.client.rest("DELETE /repos/{owner}/{repo}/issues/{issue_number}/labels/{name}", {
          owner,
          repo,
          issue_number: getNumber(payload, "issueNumber"),
          name: getString(payload, "name")
        });
      case "setAssignees":
        return this.client.rest("POST /repos/{owner}/{repo}/issues/{issue_number}/assignees", {
          owner,
          repo,
          issue_number: getNumber(payload, "issueNumber"),
          ...pick(payload, ["assignees"])
        });
      case "removeAssignees":
        return this.client.rest("DELETE /repos/{owner}/{repo}/issues/{issue_number}/assignees", {
          owner,
          repo,
          issue_number: getNumber(payload, "issueNumber"),
          ...pick(payload, ["assignees"])
        });
      case "createPullRequest":
        return this.client.rest("POST /repos/{owner}/{repo}/pulls", {
          owner,
          repo,
          ...pick(payload, ["title", "head", "base", "body", "draft", "maintainer_can_modify"])
        });
      case "mergePullRequest":
        return this.client.rest("PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge", {
          owner,
          repo,
          pull_number: getNumber(payload, "pullNumber"),
          ...pick(payload, ["commit_title", "commit_message", "merge_method", "sha"])
        });
      case "closePullRequest":
        return this.client.rest("PATCH /repos/{owner}/{repo}/pulls/{pull_number}", {
          owner,
          repo,
          pull_number: getNumber(payload, "pullNumber"),
          state: "closed"
        });
      case "reopenPullRequest":
        return this.client.rest("PATCH /repos/{owner}/{repo}/pulls/{pull_number}", {
          owner,
          repo,
          pull_number: getNumber(payload, "pullNumber"),
          state: "open"
        });
      case "approvePullRequest":
        return this.client.rest("POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews", {
          owner,
          repo,
          pull_number: getNumber(payload, "pullNumber"),
          body: typeof payload.body === "string" ? payload.body : "",
          event: "APPROVE"
        });
      case "commentPullRequestReview":
        return this.client.rest("POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews", {
          owner,
          repo,
          pull_number: getNumber(payload, "pullNumber"),
          body: typeof payload.body === "string" ? payload.body : "",
          event: "COMMENT"
        });
      case "requestChanges":
        return this.client.rest("POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews", {
          owner,
          repo,
          pull_number: getNumber(payload, "pullNumber"),
          body: typeof payload.body === "string" ? payload.body : "Changes requested from Control.",
          event: "REQUEST_CHANGES"
        });
      case "requestReviewers":
        return this.client.rest("POST /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers", {
          owner,
          repo,
          pull_number: getNumber(payload, "pullNumber"),
          reviewers: stringArray(payload.reviewers),
          team_reviewers: stringArray(payload.teamReviewers)
        });
      case "removeReviewers":
        return this.client.rest("DELETE /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers", {
          owner,
          repo,
          pull_number: getNumber(payload, "pullNumber"),
          reviewers: stringArray(payload.reviewers),
          team_reviewers: stringArray(payload.teamReviewers)
        });
      case "rerunWorkflow":
        return this.client.rest("POST /repos/{owner}/{repo}/actions/runs/{run_id}/rerun", {
          owner,
          repo,
          run_id: getNumber(payload, "runId")
        });
      case "rerunFailedWorkflowJobs":
        return this.client.rest("POST /repos/{owner}/{repo}/actions/runs/{run_id}/rerun-failed-jobs", {
          owner,
          repo,
          run_id: getNumber(payload, "runId")
        });
      case "rerunWorkflowJob":
        return this.client.rest("POST /repos/{owner}/{repo}/actions/jobs/{job_id}/rerun", {
          owner,
          repo,
          job_id: getNumber(payload, "jobId")
        });
      case "dispatchWorkflow":
        return this.client.rest("POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches", {
          owner,
          repo,
          workflow_id: getString(payload, "workflowId"),
          ref: getString(payload, "ref"),
          inputs: typeof payload.inputs === "object" && payload.inputs !== null ? payload.inputs : undefined
        });
      case "cancelWorkflow":
        return this.client.rest("POST /repos/{owner}/{repo}/actions/runs/{run_id}/cancel", {
          owner,
          repo,
          run_id: getNumber(payload, "runId")
        });
      case "createRelease":
        return this.client.rest("POST /repos/{owner}/{repo}/releases", {
          owner,
          repo,
          ...pick(payload, [
            "tag_name",
            "target_commitish",
            "name",
            "body",
            "draft",
            "prerelease",
            "make_latest"
          ])
        });
      case "editRelease":
        return this.client.rest("PATCH /repos/{owner}/{repo}/releases/{release_id}", {
          owner,
          repo,
          release_id: getNumber(payload, "releaseId"),
          ...pick(payload, [
            "tag_name",
            "target_commitish",
            "name",
            "body",
            "draft",
            "prerelease",
            "make_latest"
          ])
        });
      case "deleteRelease":
        return this.client.rest("DELETE /repos/{owner}/{repo}/releases/{release_id}", {
          owner,
          repo,
          release_id: getNumber(payload, "releaseId")
        });
      case "deleteReleaseAsset":
        return this.client.rest("DELETE /repos/{owner}/{repo}/releases/assets/{asset_id}", {
          owner,
          repo,
          asset_id: getNumber(payload, "assetId")
        });
      case "updateBranchProtection":
        return this.client.rest("PUT /repos/{owner}/{repo}/branches/{branch}/protection", {
          owner,
          repo,
          branch: getString(payload, "branch"),
          required_status_checks: payload.required_status_checks ?? null,
          enforce_admins: payload.enforce_admins ?? null,
          required_pull_request_reviews: payload.required_pull_request_reviews ?? null,
          restrictions: payload.restrictions ?? null,
          required_linear_history: payload.required_linear_history ?? false,
          allow_force_pushes: payload.allow_force_pushes ?? false,
          allow_deletions: payload.allow_deletions ?? false,
          block_creations: payload.block_creations ?? false,
          required_conversation_resolution: payload.required_conversation_resolution ?? false,
          lock_branch: payload.lock_branch ?? false,
          allow_fork_syncing: payload.allow_fork_syncing ?? false
        });
      case "deleteBranchProtection":
        return this.client.rest("DELETE /repos/{owner}/{repo}/branches/{branch}/protection", {
          owner,
          repo,
          branch: getString(payload, "branch")
        });
      case "addRepositoryCollaborator":
        return this.client.rest("PUT /repos/{owner}/{repo}/collaborators/{username}", {
          owner,
          repo,
          username: getString(payload, "username"),
          permission: payload.permission ?? "push"
        });
      case "removeRepositoryCollaborator":
        return this.client.rest("DELETE /repos/{owner}/{repo}/collaborators/{username}", {
          owner,
          repo,
          username: getString(payload, "username")
        });
      case "updateCollaboratorPermission":
        return this.client.rest("PUT /repos/{owner}/{repo}/collaborators/{username}", {
          owner,
          repo,
          username: getString(payload, "username"),
          permission: getString(payload, "permission")
        });
      case "addRepositoryTeam":
        return this.client.rest("PUT /orgs/{org}/teams/{team_slug}/repos/{owner}/{repo}", {
          org: owner,
          team_slug: getString(payload, "teamSlug"),
          owner,
          repo,
          permission: payload.permission ?? "push"
        });
      case "removeRepositoryTeam":
        return this.client.rest("DELETE /orgs/{org}/teams/{team_slug}/repos/{owner}/{repo}", {
          org: owner,
          team_slug: getString(payload, "teamSlug"),
          owner,
          repo
        });
      case "updateTeamPermission":
        return this.client.rest("PUT /orgs/{org}/teams/{team_slug}/repos/{owner}/{repo}", {
          org: owner,
          team_slug: getString(payload, "teamSlug"),
          owner,
          repo,
          permission: getString(payload, "permission")
        });
      case "createRepositoryRuleset":
        return this.client.rest("POST /repos/{owner}/{repo}/rulesets", {
          owner,
          repo,
          name: getString(payload, "name"),
          target: payload.target ?? "branch",
          enforcement: getString(payload, "enforcement"),
          bypass_actors: payload.bypass_actors ?? [],
          conditions: payload.conditions ?? {},
          rules: payload.rules ?? []
        });
      case "updateRepositoryRuleset":
        return this.client.rest("PUT /repos/{owner}/{repo}/rulesets/{ruleset_id}", {
          owner,
          repo,
          ruleset_id: getNumber(payload, "rulesetId"),
          name: getString(payload, "name"),
          target: payload.target ?? "branch",
          enforcement: getString(payload, "enforcement"),
          bypass_actors: payload.bypass_actors ?? [],
          conditions: payload.conditions ?? {},
          rules: payload.rules ?? []
        });
      case "deleteRepositoryRuleset":
        return this.client.rest("DELETE /repos/{owner}/{repo}/rulesets/{ruleset_id}", {
          owner,
          repo,
          ruleset_id: getNumber(payload, "rulesetId")
        });
      case "createDiscussion": {
        const repoData = await this.client.graphql<{ repository: { id: string } }>(
          `query RepoId($owner: String!, $repo: String!) {
            repository(owner: $owner, name: $repo) { id }
          }`,
          { owner, repo }
        );
        return this.client.graphql(
          `mutation CreateDiscussion($repoId: ID!, $categoryId: ID!, $title: String!, $body: String!) {
            createDiscussion(input: { repositoryId: $repoId, categoryId: $categoryId, title: $title, body: $body }) {
              discussion { id number title url }
            }
          }`,
          {
            repoId: repoData.repository.id,
            categoryId: getString(payload, "categoryId"),
            title: getString(payload, "title"),
            body: getString(payload, "body")
          }
        );
      }
      case "editDiscussion":
        return this.client.graphql(
          `mutation UpdateDiscussion($id: ID!, $title: String!, $body: String!) {
            updateDiscussion(input: { discussionId: $id, title: $title, body: $body }) {
              discussion { id number title url }
            }
          }`,
          {
            id: getString(payload, "discussionId"),
            title: getString(payload, "title"),
            body: getString(payload, "body")
          }
        );
      case "closeDiscussion":
        return this.client.graphql(
          `mutation CloseDiscussion($id: ID!) {
            closeDiscussion(input: { discussionId: $id, reason: NOT_PLANNED }) {
              discussion { id number title }
            }
          }`,
          { id: getString(payload, "discussionId") }
        );
      case "reopenDiscussion":
        return this.client.graphql(
          `mutation ReopenDiscussion($id: ID!) {
            reopenDiscussion(input: { discussionId: $id }) {
              discussion { id number title }
            }
          }`,
          { id: getString(payload, "discussionId") }
        );
      case "addDiscussionComment":
        return this.client.graphql(
          `mutation AddDiscussionComment($id: ID!, $body: String!) {
            addDiscussionComment(input: { discussionId: $id, body: $body }) {
              comment { id body }
            }
          }`,
          {
            id: getString(payload, "discussionId"),
            body: getString(payload, "body")
          }
        );
      case "editDiscussionComment":
        return this.client.graphql(
          `mutation UpdateDiscussionComment($id: ID!, $body: String!) {
            updateDiscussionComment(input: { commentId: $id, body: $body }) {
              comment { id body }
            }
          }`,
          {
            id: getString(payload, "commentId"),
            body: getString(payload, "body")
          }
        );
      case "deleteDiscussionComment":
        return this.client.graphql(
          `mutation DeleteDiscussionComment($id: ID!) {
            deleteDiscussionComment(input: { commentId: $id }) {
              clientMutationId
            }
          }`,
          { id: getString(payload, "commentId") }
        );
      case "createProjectV2": {
        const ownerData = await this.client.graphql<{ repository: { owner: { id: string } } }>(
          `query RepoOwnerId($owner: String!, $repo: String!) {
            repository(owner: $owner, name: $repo) { owner { id } }
          }`,
          { owner, repo }
        );
        return this.client.graphql(
          `mutation CreateProjectV2($ownerId: ID!, $title: String!) {
            createProjectV2(input: { ownerId: $ownerId, title: $title }) {
              projectV2 { id number title url }
            }
          }`,
          {
            ownerId: ownerData.repository.owner.id,
            title: getString(payload, "title")
          }
        );
      }
      case "updateProjectV2": {
        const id = getString(payload, "projectId");
        const title = getString(payload, "title");
        return this.client.graphql(
          `mutation UpdateProjectV2($id: ID!, $title: String!, $shortDescription: String, $readme: String) {
            updateProjectV2(input: { projectId: $id, title: $title, shortDescription: $shortDescription, readme: $readme }) {
              projectV2 { id number title }
            }
          }`,
          {
            id,
            title,
            shortDescription: typeof payload.shortDescription === "string" ? payload.shortDescription : null,
            readme: typeof payload.readme === "string" ? payload.readme : null
          }
        );
      }
      case "deleteProjectV2":
        return this.client.graphql(
          `mutation DeleteProjectV2($id: ID!) {
            deleteProjectV2(input: { projectId: $id }) {
              clientMutationId
            }
          }`,
          { id: getString(payload, "projectId") }
        );
      case "addProjectV2Item":
        return this.client.graphql(
          `mutation AddProjectV2Item($projectId: ID!, $contentId: ID!) {
            addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
              item { id }
            }
          }`,
          {
            projectId: getString(payload, "projectId"),
            contentId: getString(payload, "contentId")
          }
        );
      case "updateProjectV2Item":
        return this.client.graphql(
          `mutation UpdateProjectV2Item($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: ProjectV2FieldValue!) {
            updateProjectV2ItemFieldValue(input: { projectId: $projectId, itemId: $itemId, fieldId: $fieldId, value: $value }) {
              projectV2Item { id }
            }
          }`,
          {
            projectId: getString(payload, "projectId"),
            itemId: getString(payload, "itemId"),
            fieldId: getString(payload, "fieldId"),
            value: (payload.value as string | number | boolean | null) ?? null
          }
        );
      case "deleteProjectV2Item":
        return this.client.graphql(
          `mutation DeleteProjectV2Item($projectId: ID!, $itemId: ID!) {
            deleteProjectV2Item(input: { projectId: $projectId, itemId: $itemId }) {
              clientMutationId
            }
          }`,
          {
            projectId: getString(payload, "projectId"),
            itemId: getString(payload, "itemId")
          }
        );
      case "createWikiPage": {
        const wikiRepo = `${repo}.wiki`;
        const title = getString(payload, "title");
        const content = getString(payload, "content");
        const pagePath = `${title}.md`;

        const ref = await this.client.rest<{ object: { sha: string } }>(
          "GET /repos/{owner}/{repo}/git/ref/heads/master",
          { owner, repo: wikiRepo }
        );
        const commitSha = ref.object.sha;

        const commit = await this.client.rest<{ tree: { sha: string } }>(
          "GET /repos/{owner}/{repo}/git/commits/{commit_sha}",
          { owner, repo: wikiRepo, commit_sha: commitSha }
        );

        const blob = await this.client.rest<{ sha: string }>("POST /repos/{owner}/{repo}/git/blobs", {
          owner,
          repo: wikiRepo,
          content,
          encoding: "utf-8"
        });

        const tree = await this.client.rest<{ sha: string }>("POST /repos/{owner}/{repo}/git/trees", {
          owner,
          repo: wikiRepo,
          base_tree: commit.tree.sha,
          tree: [{ path: pagePath, mode: "100644", type: "blob", sha: blob.sha }]
        });

        const newCommit = await this.client.rest<{ sha: string }>("POST /repos/{owner}/{repo}/git/commits", {
          owner,
          repo: wikiRepo,
          message: `Created ${title}`,
          tree: tree.sha,
          parents: [commitSha]
        });

        return this.client.rest("PATCH /repos/{owner}/{repo}/git/refs/heads/master", {
          owner,
          repo: wikiRepo,
          sha: newCommit.sha,
          force: false
        });
      }
      case "editWikiPage": {
        const wikiRepo = `${repo}.wiki`;
        const pagePath = getString(payload, "pagePath");
        const content = getString(payload, "content");
        const title = pagePath.replace(/\.md$/, "");

        const ref = await this.client.rest<{ object: { sha: string } }>(
          "GET /repos/{owner}/{repo}/git/ref/heads/master",
          { owner, repo: wikiRepo }
        );
        const commitSha = ref.object.sha;

        const commit = await this.client.rest<{ tree: { sha: string } }>(
          "GET /repos/{owner}/{repo}/git/commits/{commit_sha}",
          { owner, repo: wikiRepo, commit_sha: commitSha }
        );

        const blob = await this.client.rest<{ sha: string }>("POST /repos/{owner}/{repo}/git/blobs", {
          owner,
          repo: wikiRepo,
          content,
          encoding: "utf-8"
        });

        const tree = await this.client.rest<{ sha: string }>("POST /repos/{owner}/{repo}/git/trees", {
          owner,
          repo: wikiRepo,
          base_tree: commit.tree.sha,
          tree: [{ path: pagePath, mode: "100644", type: "blob", sha: blob.sha }]
        });

        const newCommit = await this.client.rest<{ sha: string }>("POST /repos/{owner}/{repo}/git/commits", {
          owner,
          repo: wikiRepo,
          message: `Updated ${title}`,
          tree: tree.sha,
          parents: [commitSha]
        });

        return this.client.rest("PATCH /repos/{owner}/{repo}/git/refs/heads/master", {
          owner,
          repo: wikiRepo,
          sha: newCommit.sha,
          force: false
        });
      }
      case "deleteWikiPage": {
        const wikiRepo = `${repo}.wiki`;
        const pagePath = getString(payload, "pagePath");
        const title = pagePath.replace(/\.md$/, "");

        const ref = await this.client.rest<{ object: { sha: string } }>(
          "GET /repos/{owner}/{repo}/git/ref/heads/master",
          { owner, repo: wikiRepo }
        );
        const commitSha = ref.object.sha;

        const commit = await this.client.rest<{ tree: { sha: string } }>(
          "GET /repos/{owner}/{repo}/git/commits/{commit_sha}",
          { owner, repo: wikiRepo, commit_sha: commitSha }
        );

        const tree = await this.client.rest<{ sha: string }>("POST /repos/{owner}/{repo}/git/trees", {
          owner,
          repo: wikiRepo,
          base_tree: commit.tree.sha,
          tree: [{ path: pagePath, mode: "100644", type: "blob", sha: null }]
        });

        const newCommit = await this.client.rest<{ sha: string }>("POST /repos/{owner}/{repo}/git/commits", {
          owner,
          repo: wikiRepo,
          message: `Deleted ${title}`,
          tree: tree.sha,
          parents: [commitSha]
        });

        return this.client.rest("PATCH /repos/{owner}/{repo}/git/refs/heads/master", {
          owner,
          repo: wikiRepo,
          sha: newCommit.sha,
          force: false
        });
      }
      default:
        throw new Error(`Unsupported GitHub action: ${(input as { action: string }).action}`);
    }
  }
}

function getNumber(payload: GitHubMutationRuntimePayload, key: keyof GitHubMutationFields): number {
  const value = payload[key];
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`GitHub action payload requires numeric ${key}.`);
  }
  return value;
}

function getString(payload: GitHubMutationRuntimePayload, key: keyof GitHubMutationFields): string {
  const value = payload[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`GitHub action payload requires string ${key}.`);
  }
  return value;
}

function pick(
  payload: GitHubMutationRuntimePayload,
  keys: Array<keyof GitHubMutationFields>
): Record<string, unknown> {
  return keys.reduce<Record<string, unknown>>((acc, key) => {
    if (payload[key] !== undefined) {
      acc[key] = payload[key];
    }
    return acc;
  }, {});
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}
