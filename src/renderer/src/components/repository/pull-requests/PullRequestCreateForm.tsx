import { GitPullRequest } from "lucide-react";
import type { FormEvent, JSX } from "react";

import type { RepositoryDetail } from "@shared/github";

import { githubActionLabel } from "@renderer/components/repository/repositoryUi";

export interface PullRequestCreateDraft {
  title: string;
  head: string;
  base: string;
  body: string;
  createDraft: boolean;
  maintainerCanModify: boolean;
}

export interface PullRequestCreateFormStatus {
  createPullMutationActive: boolean;
  mutationPending: boolean;
  mutationSucceeded: boolean;
  mutationError: Error | null;
}

export function PullRequestCreateForm({
  repository,
  branchOptions,
  branchesError,
  effectiveBaseBranch,
  disabledReason,
  submitDisabledReason,
  draft,
  status,
  onDraftChange,
  onSubmit,
  onCancel
}: {
  repository: RepositoryDetail;
  branchOptions: string[];
  branchesError: Error | null;
  effectiveBaseBranch: string;
  disabledReason: string | null;
  submitDisabledReason: string | null;
  draft: PullRequestCreateDraft;
  status: PullRequestCreateFormStatus;
  onDraftChange(draft: PullRequestCreateDraft): void;
  onSubmit(): void;
  onCancel(): void;
}): JSX.Element {
  const inputDisabled = Boolean(disabledReason);
  const inputTitle = disabledReason ?? undefined;

  function updateDraft(patch: Partial<PullRequestCreateDraft>): void {
    onDraftChange({ ...draft, ...patch });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!submitDisabledReason) {
      onSubmit();
    }
  }

  return (
    <form className="compose-form" onSubmit={handleSubmit}>
      <h2>Open a pull request</h2>
      {status.createPullMutationActive && status.mutationPending && (
        <div className="loading-state">
          {githubActionLabel("createPullRequest")} is running. The draft is locked until GitHub responds.
        </div>
      )}
      {status.createPullMutationActive && !status.mutationPending && status.mutationSucceeded && (
        <div className="success-state">
          {githubActionLabel("createPullRequest")} completed. Pull request data is refreshing.
        </div>
      )}
      {status.createPullMutationActive && !status.mutationPending && status.mutationError && (
        <div className="error-state">
          {githubActionLabel("createPullRequest")} failed: {status.mutationError.message}
        </div>
      )}
      <input
        value={draft.title}
        disabled={inputDisabled}
        title={inputTitle}
        onChange={(event) => updateDraft({ title: event.target.value })}
        placeholder="Pull request title"
      />
      <input
        value={draft.head}
        list={`pull-head-branches-${repository.id}`}
        disabled={inputDisabled}
        title={inputTitle}
        onChange={(event) => updateDraft({ head: event.target.value })}
        placeholder="compare branch"
      />
      <input
        value={draft.base}
        list={`pull-base-branches-${repository.id}`}
        disabled={inputDisabled}
        title={inputTitle}
        onChange={(event) => updateDraft({ base: event.target.value })}
        placeholder="base branch"
      />
      <datalist id={`pull-head-branches-${repository.id}`}>
        {branchOptions.map((branch) => (
          <option key={`head-${branch}`} value={branch} />
        ))}
      </datalist>
      <datalist id={`pull-base-branches-${repository.id}`}>
        {branchOptions.map((branch) => (
          <option key={`base-${branch}`} value={branch} />
        ))}
      </datalist>
      {branchesError && (
        <small className="action-disabled-note">
          Branch suggestions unavailable: {branchesError.message}. Enter branch names manually.
        </small>
      )}
      <textarea
        value={draft.body}
        disabled={inputDisabled}
        title={inputTitle}
        onChange={(event) => updateDraft({ body: event.target.value })}
        placeholder="Describe the changes"
      />
      <small>
        Base branch: <strong>{effectiveBaseBranch}</strong>
      </small>
      <div className="release-options">
        <label>
          <input
            checked={draft.createDraft}
            type="checkbox"
            disabled={inputDisabled}
            title={inputTitle}
            onChange={(event) => updateDraft({ createDraft: event.target.checked })}
          />
          Draft pull request
        </label>
        <label>
          <input
            checked={draft.maintainerCanModify}
            type="checkbox"
            disabled={inputDisabled}
            title={inputTitle}
            onChange={(event) => updateDraft({ maintainerCanModify: event.target.checked })}
          />
          Allow maintainer edits
        </label>
      </div>
      <div>
        <button
          className="dark-action"
          type="submit"
          disabled={Boolean(submitDisabledReason)}
          title={submitDisabledReason ?? undefined}
        >
          <GitPullRequest size={16} /> Create pull request
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        {submitDisabledReason && (
          <small className="action-disabled-note">
            Pull request creation unavailable: {submitDisabledReason}
          </small>
        )}
      </div>
    </form>
  );
}
