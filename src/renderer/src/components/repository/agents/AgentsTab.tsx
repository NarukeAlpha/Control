import { Bot, GitPullRequest, Workflow, type LucideIcon } from "lucide-react";
import type { JSX } from "react";

import type { IssueSummary, PullRequestSummary, RepositoryDetail, WorkflowRunSummary } from "@shared/github";
import { formatRelativeDate } from "../../../utils/format";
import { useActionsTabQueries } from "../actions/ActionsTab.queries";
import { useIssuesTabQueries } from "../issues/IssuesTab.queries";
import { usePullRequestsTabQueries } from "../pull-requests/PullRequestsTab.queries";
import { isWorkflowRunAttention } from "../workflows/workflowRunState";

type AgentSurfaceTab = "issues" | "pulls" | "actions";

interface AgentPreviewItem {
  title: string;
  meta: string;
  actionLabel: string;
  action(): void;
}

interface AgentLink {
  title: string;
  description: string;
  count: number;
  errored: boolean;
  chip: string;
  detail: string;
  icon: LucideIcon;
  tab: AgentSurfaceTab;
  filter: string;
  path: string;
  preview: AgentPreviewItem[];
  emptyPreview: string;
}

export interface AgentsTabProps {
  repository: RepositoryDetail;
  githubReady: boolean;
  issueListLimit: number;
  pullRequestListLimit: number;
  actionsLimit: number;
  onOpenExternal(url: string): void;
  onOpenFilteredSurface(tab: AgentSurfaceTab, filter: string): void;
  onSelectIssue(issue: IssueSummary): void;
  onSelectPullRequest(pullRequest: PullRequestSummary): void;
  onSelectWorkflowRun(run: WorkflowRunSummary): void;
}

export function AgentsTab({
  repository,
  githubReady,
  issueListLimit,
  pullRequestListLimit,
  actionsLimit,
  onOpenExternal,
  onOpenFilteredSurface,
  onSelectIssue,
  onSelectPullRequest,
  onSelectWorkflowRun
}: AgentsTabProps): JSX.Element {
  const { issues } = useIssuesTabQueries({
    owner: repository.owner,
    repo: repository.name,
    issueListLimit,
    issuesEnabled: true,
    resourcesEnabled: false,
    githubReady
  });
  const { pulls } = usePullRequestsTabQueries({
    owner: repository.owner,
    repo: repository.name,
    pullRequestListLimit,
    pullsEnabled: true,
    resourcesEnabled: false,
    githubReady
  });
  const { actions } = useActionsTabQueries({
    owner: repository.owner,
    repo: repository.name,
    limit: actionsLimit,
    enabled: true,
    githubReady
  });
  const issueItems = issues.data?.items ?? [];
  const pullItems = pulls.data?.items ?? [];
  const actionItems = actions.data?.items ?? [];
  const issuesLoading = issues.isLoading || issues.isFetching;
  const pullsLoading = pulls.isLoading || pulls.isFetching;
  const actionsLoading = actions.isLoading || actions.isFetching;
  const issuesError = issues.error;
  const pullsError = pulls.error;
  const actionsError = actions.error;
  const agentIssues = issueItems.filter(
    (issue) =>
      issue.state.toLowerCase() === "open" &&
      issue.labels.some((label) => label.name.toLowerCase() === "agent")
  );
  const automationRuns = actionItems.filter(isWorkflowRunAttention);
  const openPulls = pullItems.filter((pull) => pull.state.toLowerCase() === "open");
  const agentIssuePreview = agentIssues.slice(0, 3).map((issue) => ({
    title: `#${issue.number} ${issue.title}`,
    meta: `updated ${formatRelativeDate(issue.updatedAt)}`,
    actionLabel: `Open issue #${issue.number} in Control`,
    action: () => onSelectIssue(issue)
  }));
  const automationRunPreview = automationRuns.slice(0, 3).map((run) => ({
    title: run.displayTitle ?? run.name,
    meta: `${formatAgentPreviewState(run.conclusion ?? run.status ?? "queued")} · updated ${formatRelativeDate(run.updatedAt)}`,
    actionLabel: `Open workflow run ${run.displayTitle ?? run.name} in Control`,
    action: () => onSelectWorkflowRun(run)
  }));
  const pullQueuePreview = openPulls.slice(0, 3).map((pull) => ({
    title: `#${pull.number} ${pull.title}`,
    meta: `${formatPullQueueState(pull)} · updated ${formatRelativeDate(pull.updatedAt)}`,
    actionLabel: `Open pull request #${pull.number} in Control`,
    action: () => onSelectPullRequest(pull)
  }));
  const agentLinks: AgentLink[] = [
    {
      title: "Agent issues",
      description: "Open repository work labeled for agents.",
      count: agentIssues.length,
      errored: Boolean(issuesError),
      chip: issuesError ? "unavailable" : issuesLoading ? "loading" : `${agentIssues.length} open`,
      detail: issuesError
        ? `Agent issues unavailable: ${issuesError.message}`
        : issuesLoading
          ? "Loading issue labels from the repository cache."
          : `${agentIssues.length} open issue${agentIssues.length === 1 ? "" : "s"} currently carries the agent label.`,
      icon: Bot,
      tab: "issues",
      filter: "label:agent",
      path: "/issues?q=is%3Aissue%20is%3Aopen%20label%3Aagent",
      preview: agentIssuePreview,
      emptyPreview: "No agent-labeled issues in the current cache."
    },
    {
      title: "Automation runs",
      description: "Review workflow runs agents can act on.",
      count: automationRuns.length,
      errored: Boolean(actionsError),
      chip: actionsError ? "unavailable" : actionsLoading ? "loading" : `${automationRuns.length} attention`,
      detail: actionsError
        ? `Automation runs unavailable: ${actionsError.message}`
        : actionsLoading
          ? "Loading workflow run status from the repository cache."
          : `${automationRuns.length} run${automationRuns.length === 1 ? "" : "s"} failed, need action, or are still active.`,
      icon: Workflow,
      tab: "actions",
      filter: "attention",
      path: "/actions",
      preview: automationRunPreview,
      emptyPreview: "No workflow runs currently need attention."
    },
    {
      title: "Pull request queue",
      description: "Open pull requests that may need review or fixes.",
      count: openPulls.length,
      errored: Boolean(pullsError),
      chip: pullsError ? "unavailable" : pullsLoading ? "loading" : `${openPulls.length} open`,
      detail: pullsError
        ? `PR queue unavailable: ${pullsError.message}`
        : pullsLoading
          ? "Loading pull request state from the repository cache."
          : `${openPulls.length} open pull request${openPulls.length === 1 ? "" : "s"} are in the queue.`,
      icon: GitPullRequest,
      tab: "pulls",
      filter: "open",
      path: "/pulls",
      preview: pullQueuePreview,
      emptyPreview: "No open pull requests in the current cache."
    }
  ];

  return (
    <section className="agents-surface">
      <div className="external-workflow-note">
        <span className="state-chip success">in-app first</span>
        <div>
          <h2>Agent workflows open in Control</h2>
          <p>
            Control routes common agent triage paths to the existing Issues, Actions, and Pull requests
            surfaces. GitHub remains available for unsupported filtered views.
          </p>
        </div>
      </div>
      <div className="tile-grid">
        {agentLinks.map((item) => {
          const Icon = item.icon;
          const chipClassName = `state-chip ${
            item.errored || (item.chip !== "loading" && item.count > 0) ? "attention" : ""
          }`;
          return (
            <article className="project-tile" key={item.title}>
              <Icon size={20} />
              <strong>{item.title}</strong>
              <span className={chipClassName}>{item.chip}</span>
              <small>{item.description}</small>
              <small>{item.detail}</small>
              <div className="agent-preview-list" aria-label={`${item.title} preview`}>
                {item.preview.length > 0
                  ? item.preview.map((preview) => (
                      <button
                        className="agent-preview-row"
                        key={`${item.title}-${preview.title}`}
                        type="button"
                        onClick={preview.action}
                        title={preview.actionLabel}
                        aria-label={preview.actionLabel}
                      >
                        <span>{preview.title}</span>
                        <small>{preview.meta}</small>
                      </button>
                    ))
                  : !item.errored &&
                    item.chip !== "loading" && (
                      <small className="agent-preview-empty">{item.emptyPreview}</small>
                    )}
              </div>
              <div className="tile-actions">
                <button type="button" onClick={() => onOpenFilteredSurface(item.tab, item.filter)}>
                  Open in Control
                </button>
                <button type="button" onClick={() => onOpenExternal(`${repository.htmlUrl}${item.path}`)}>
                  Open on GitHub
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function formatAgentPreviewState(value: string): string {
  return value.replace(/_/g, " ");
}

function formatPullQueueState(pull: PullRequestSummary): string {
  const queueState = pull.isDraft ? "draft" : pull.state;
  return pull.mergeableState ? `${queueState} · ${formatAgentPreviewState(pull.mergeableState)}` : queueState;
}
