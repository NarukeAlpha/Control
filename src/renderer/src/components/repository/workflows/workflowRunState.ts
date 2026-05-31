import type { WorkflowRunSummary } from "@shared/github";

const workflowAttentionConclusions = new Set(["failure", "timed_out", "action_required", "cancelled"]);
const workflowAttentionStatuses = new Set(["in_progress", "queued", "waiting", "requested"]);

export function isWorkflowRunAttention(run: Pick<WorkflowRunSummary, "conclusion" | "status">): boolean {
  const conclusion = run.conclusion?.toLowerCase();
  const status = run.status?.toLowerCase();
  return (
    Boolean(conclusion && workflowAttentionConclusions.has(conclusion)) ||
    Boolean(status && workflowAttentionStatuses.has(status))
  );
}
