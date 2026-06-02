---
name: control-main-merge
description: Use when syncing, merging, rebasing, or pulling origin/main into a Control feature branch, resolving merge conflicts, or auditing merge results for UI regressions in Control. Prioritizes preserving branch behavior, main changes, route/layout state, and validation evidence.
---

# Control Main Merge

Use this skill when bringing `origin/main` into a Control feature branch or when auditing a merge that may have dropped UI behavior.

## Pre-Merge Audit

1. Confirm the worktree is clean or explicitly identify unrelated dirty files before merging.
2. Capture branch context:
   - `git branch --show-current`
   - `git status --short --untracked-files=all`
   - `git log --oneline --left-right origin/main...HEAD`
   - `git diff --name-status origin/main...HEAD`
3. Identify whether the branch touches shared seams. Read [merge-seams.md](references/merge-seams.md) when shared contracts, shell layout, refresh/invalidation, or CSS are involved.
4. Identify user-visible UI promises from the feature branch before resolving conflicts. Treat screenshots, tests, appshots, recent user requests, and branch diffs as evidence.

## Conflict Rules

- Do not resolve Control conflicts with wholesale `ours` or `theirs` in shared files.
- For each conflicted file, inspect base, incoming `main`, current branch, and the intended final behavior.
- Preserve both intent streams: bug fixes from `main` and the feature behavior from the branch.
- After resolving a file, run `rg "<<<<<<<|=======|>>>>>>>"` before moving on.
- If the conflict is in a critical UI section and it is unclear which visual state is correct, pause and ask the user instead of guessing.

## Critical UI Ask-User Rule

Ask for user input when a conflict or merge result affects a critical UI element and the correct outcome cannot be proven from code, tests, screenshots, or the conversation.

Make the question concrete and component-scoped. Include:

- the component or stylesheet selector involved
- the competing interpretations
- the visible UI consequence
- a recommended default when one is safer

Example prompt:

```text
I need your call on `Sidebar` in `src/renderer/src/components/sidebar/Sidebar.tsx`.
`main` keeps Organizations/Mailbox visible globally, while this branch hides them for Local/SSH Areas.
Should Local and SSH sidebars show only Home/Repositories, while GitHub keeps all four items? Recommended: keep the branch behavior because it matches the current Area boundary.
```

Use [ui-regression-checklist.md](references/ui-regression-checklist.md) for critical sections and component callbacks.

## Resolution Workflow

1. Resolve data contracts first: shared types, IPC, main-process provider/domain changes.
2. Resolve route orchestration next: `App.tsx`, shell components, route state hooks, invalidation hooks.
3. Resolve surface components after their upstream contracts are stable.
4. Resolve `styles.css` last when possible, because CSS conflicts often hide visual regressions.
5. Re-run focused tests for touched behavior before declaring a merge successful.

## Regression Audit

After conflicts are resolved:

- Compare `git diff origin/main...HEAD` and verify that the feature branch behavior still exists.
- Search for removed labels, selectors, routes, tests, query keys, and props tied to the feature.
- For UI/layout changes, verify with the in-app browser or Playwright snapshot/screenshot.
- For uncertain critical UI behavior, ask the user using the component-scoped format above.

## Required Validation

Run repository validation before closing:

```bash
bun run format
bun run lint
bun run typecheck
bun run build
```

Also run focused tests for touched surfaces, such as:

```bash
bun run test -- src/renderer/src/App.test.tsx
```

Never add e2e tests unless the user explicitly asks.
