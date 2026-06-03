# Cleanup Remediation Record

## Purpose

This file records the cleanup work found by the repository audit and now implemented. The older cleanup plans also live
in `docs/done` because they describe completed foundation work.

The scope was intentionally task-like. Every item identified:

- the source lines or functions that currently carry the problem
- the failure mode or architecture violation
- the smallest credible change
- the tests, diagnostics, or manual checks that prove the work is complete

## Documents

| File                                          | Scope                                                                                                                                               |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `main-process-infrastructure-cleanup.md`      | Gateway operation safety, gateway lifecycle cleanup, durable storage, keychain errors, local file boundaries, and IPC helper ownership.             |
| `renderer-query-and-components-cleanup.md`    | Branch protection, query fan-out, component decomposition, inline callback cleanup, derived-state ownership, and renderer confirmation flows.       |
| `tooling-triage-cleanup.md`                   | Current Knip and React Doctor baselines, ownership rules, and actionable must-fix/deferred diagnostic buckets.                                      |
| `validation-dead-code-and-tooling-cleanup.md` | Dead/stale files, dependency/tooling drift, dev audit vulnerabilities, React Doctor follow-up, Shiki bundle pressure, and docs command consistency. |

## Completed Order

1. Fix destructive or unsafe main-process behavior first:
   - `MAIN-01` enforce gateway confirmation in main.
   - `MAIN-02` make gateway operation mapping exhaustive and honest.
   - `RENDER-01` / `MAIN-07` make branch protection updates non-destructive.
   - `MAIN-06` harden local file symlink handling.
2. Stabilize failure states:
   - `MAIN-03` clean up partially started gateways.
   - `MAIN-04` stop silently downgrading SQLite failures to memory storage.
   - `MAIN-05` distinguish keychain failure from signed-out auth.
3. Reduce renderer/query blast radius:
   - `RENDER-02` gate PR subresource queries.
   - `RENDER-03` split route orchestration from tab components.
   - `RENDER-04` through `RENDER-06` decompose large components and repeated inline handlers.
4. Finish validation and dead-code work:
   - `TOOL-01` through `TOOL-05` keep package manager, Playwright, audit, docs commands, and Cargo output handling
     consistent.
   - `DEAD-01` remove or revive the stale file blame surface.
   - `PERF-01` reduce Shiki output pressure.

## Evidence Used

The cleanup audit used these commands and source inspections:

- `bun run format:check`
- `bun run lint`
- `bun run typecheck`
- `bun run test`
- `bun run build`
- `cargo test`
- `npm audit`
- `npm audit --omit=dev`
- `bunx knip --reporter compact`
- `react-doctor . --offline --verbose`
- TypeScript AST scans for large functions and JSX inline callbacks

## Completion Rules

A task is not complete when code merely compiles. Mark a task complete only when all of the following are true:

- The source lines listed in the task no longer have the documented failure mode.
- The fix follows the repository's process boundaries: main owns privileged work, preload exposes typed IPC, renderer owns
  presentation and client state only, and shared owns serializable contracts.
- The task-specific tests listed in the document pass.
- Repository gates pass: `bun run format`, `bun run lint`, `bun run typecheck`, `bun run test`, and `bun run build`.
- Any changed gateway code also passes `cargo test` when Rust code or gateway packaging behavior is involved.
