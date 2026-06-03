import { ExternalLink } from "lucide-react";
import { useState, type FormEvent, type JSX } from "react";

import type { GitHubAction, GitHubMutationFields, RepositoryRulesetSummary } from "@shared/github";

import { accessRoleLabel } from "@renderer/components/repository/repositoryUi";

function rulesetConditionLabel(condition: RepositoryRulesetSummary["conditions"][number]): string {
  const refDetails = [
    ...condition.include.map((ref) => `include ${ref}`),
    ...condition.exclude.map((ref) => `exclude ${ref}`)
  ];
  return rulesetPartLabel(condition.type, [...refDetails, ...condition.parameters]);
}

function rulesetRuleLabel(rule: RepositoryRulesetSummary["rules"][number]): string {
  return rulesetPartLabel(rule.type, rule.parameters);
}

function rulesetBypassActorLabel(actor: RepositoryRulesetSummary["bypassActors"][number]): string {
  const actorName = [actor.actorType, actor.actorId === null ? null : `#${actor.actorId}`]
    .filter(Boolean)
    .join(" ");
  const bypassMode = actor.bypassMode ? `via ${accessRoleLabel(actor.bypassMode)}` : null;
  return [actorName || "Unknown bypass actor", bypassMode].filter(Boolean).join(" ");
}

function rulesetPartLabel(name: string, details: string[]): string {
  const label = accessRoleLabel(name);
  const visibleDetails = details.filter(Boolean).slice(0, 3);
  return visibleDetails.length > 0 ? `${label}: ${visibleDetails.join(", ")}` : label;
}

function rulesetCompactSummary(ruleset: RepositoryRulesetSummary): string {
  const parts = [
    ...ruleset.rules.slice(0, 2).map((rule) => `Rule ${rulesetRuleLabel(rule)}`),
    ...ruleset.conditions.slice(0, 1).map((condition) => `Condition ${rulesetConditionLabel(condition)}`),
    ...ruleset.bypassActors.slice(0, 1).map((actor) => `Bypass ${rulesetBypassActorLabel(actor)}`)
  ];
  return parts.length > 0 ? parts.join(" · ") : "No detailed ruleset payload returned.";
}

export function RepositoryRulesetsSection({
  repositoryName,
  defaultBranch,
  rulesets,
  rulesetsLimit,
  loading,
  error,
  availabilityMessage,
  disabledReason,
  onOpenExternal,
  onMutate
}: {
  repositoryName: string;
  defaultBranch: string | null;
  rulesets: RepositoryRulesetSummary[];
  rulesetsLimit: number;
  loading: boolean;
  error: Error | null;
  availabilityMessage: string | null;
  disabledReason: string | null;
  onOpenExternal(url: string): void;
  onMutate(action: GitHubAction, dangerous: boolean, payload?: GitHubMutationFields): void;
}): JSX.Element {
  const [rulesetName, setRulesetName] = useState("");
  const [rulesetEnforcement, setRulesetEnforcement] = useState("active");
  const disabled = Boolean(disabledReason);

  function rulesetPayload(ruleset?: RepositoryRulesetSummary): GitHubMutationFields {
    const name = rulesetName.trim() || ruleset?.name || `${repositoryName} branch rules`;
    return {
      rulesetId: ruleset?.id,
      name,
      target: ruleset?.target ?? "branch",
      enforcement: ruleset?.enforcement ?? rulesetEnforcement,
      bypass_actors: [],
      conditions: {
        ref_name: {
          include: defaultBranch ? [`refs/heads/${defaultBranch}`] : ["~DEFAULT_BRANCH"],
          exclude: []
        }
      },
      rules: [
        { type: "deletion" },
        { type: "non_fast_forward" },
        {
          type: "pull_request",
          parameters: {
            required_approving_review_count: 1,
            dismiss_stale_reviews_on_push: true,
            require_code_owner_review: false,
            require_last_push_approval: false,
            required_review_thread_resolution: true
          }
        }
      ]
    };
  }

  function submitCreateRuleset(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (disabled || rulesetName.trim().length === 0) {
      return;
    }
    onMutate("createRepositoryRuleset", false, rulesetPayload());
    setRulesetName("");
  }

  return (
    <section className="repository-admin-section">
      <header>
        <div>
          <h3>Repository rulesets</h3>
          <small>Basic create/update/delete controls for repository-owned rulesets.</small>
        </div>
        <span className={`state-chip ${error || availabilityMessage ? "attention" : ""}`}>
          {loading && rulesets.length === 0
            ? "loading"
            : error || availabilityMessage
              ? "unavailable"
              : `${rulesets.length} rulesets`}
        </span>
      </header>
      {error && <div className="error-state">Repository rulesets unavailable: {error.message}</div>}
      {availabilityMessage && <div className="error-state">{availabilityMessage}</div>}
      <form className="repository-admin-form repository-admin-inline-form" onSubmit={submitCreateRuleset}>
        <label>
          Ruleset name
          <input
            value={rulesetName}
            placeholder="Branch rules"
            disabled={disabled}
            title={disabledReason ?? undefined}
            onChange={(event) => setRulesetName(event.target.value)}
          />
        </label>
        <label>
          Enforcement
          <select
            value={rulesetEnforcement}
            disabled={disabled}
            title={disabledReason ?? undefined}
            onChange={(event) => setRulesetEnforcement(event.target.value)}
          >
            <option value="active">active</option>
            <option value="evaluate">evaluate</option>
            <option value="disabled">disabled</option>
          </select>
        </label>
        <button
          className="dark-action"
          type="submit"
          disabled={disabled || rulesetName.trim().length === 0}
          title={disabledReason ?? "Enter a ruleset name."}
        >
          Create ruleset
        </button>
      </form>
      {rulesets.length > 0 && (
        <div className="repository-admin-list">
          {rulesets.map((ruleset) => {
            const inherited = ruleset.sourceType !== null && ruleset.sourceType !== "Repository";
            const rowDisabledReason = inherited
              ? "Inherited rulesets must be managed from their source."
              : (disabledReason ?? null);
            return (
              <div className="repository-admin-row" key={ruleset.id}>
                <span>
                  <strong>{ruleset.name}</strong>
                  <small>
                    {ruleset.enforcement ?? "unknown"} · {ruleset.target ?? "target unknown"}
                    {ruleset.source ? ` · ${ruleset.source}` : ""}
                  </small>
                  <small>{rulesetCompactSummary(ruleset)}</small>
                </span>
                <div>
                  <button
                    type="button"
                    disabled={Boolean(rowDisabledReason)}
                    title={rowDisabledReason ?? undefined}
                    onClick={() => onMutate("updateRepositoryRuleset", false, rulesetPayload(ruleset))}
                  >
                    Apply baseline
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(rowDisabledReason)}
                    title={rowDisabledReason ?? undefined}
                    onClick={() => onMutate("deleteRepositoryRuleset", true, { rulesetId: ruleset.id })}
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    disabled={!ruleset.htmlUrl}
                    title={ruleset.htmlUrl ? "Open ruleset on GitHub" : "Ruleset URL unavailable."}
                    onClick={() => {
                      if (ruleset.htmlUrl) {
                        onOpenExternal(ruleset.htmlUrl);
                      }
                    }}
                  >
                    <ExternalLink size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {rulesets.length >= rulesetsLimit && (
        <div className="muted-row">Showing the first {rulesets.length} rulesets returned by GitHub.</div>
      )}
      {disabledReason && <small className="action-disabled-note">{disabledReason}</small>}
    </section>
  );
}
