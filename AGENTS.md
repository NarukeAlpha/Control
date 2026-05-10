# Repository Guidelines

## Project Snapshot & Priorities
Control is a local-first Electron desktop client for GitHub. Optimize for:

- performance first
- reliability first
- predictable behavior during auth, caching, reconnects, and partial failures

If a tradeoff is required, choose correctness and robustness over short-term convenience.

## Project Structure & Module Organization
Keep process boundaries clear:

- `src/main`: Electron main-process code, GitHub/provider orchestration, storage, credentials.
- `src/preload`: typed IPC bridge exposed to the renderer.
- `src/renderer/src`: React UI, client-side state, query code, styles, and renderer tests.
- `src/shared`: serializable contracts shared across processes.
- `tests/e2e`: Playwright coverage, including benchmark-style GitHub flows.
- `docs`: architecture notes, design plans, and implementation docs.

## Build, Test, and Development Commands
- `bun run dev`: start the Electron app in development.
- `bun run build`: build production output.
- `bun run format`: run Prettier across the repo.
- `bun run lint`: run ESLint.
- `bun run typecheck`: run TypeScript without emitting files.
- `bun run test`: run Vitest unit tests.
- `bun run test:e2e`: run Playwright end-to-end tests. Never add tests to e2e unless specifically asked to.

Before closing work, `bun run format`, `bun run lint`, and `bun run typecheck` must pass. Never call `vitest` directly when validating work; use `bun run test`.

## Coding Style & Naming Conventions
Use TypeScript, 2-space indentation, semicolons, double quotes, and `110`-column formatting as enforced by Prettier. Match existing naming:

- React components: `PascalCase`
- utilities, stores, helpers: `camelCase`
- tests: `*.test.ts` or `*.test.tsx`

Prefer shared abstractions over copy-pasted local fixes. If behavior duplicates existing logic, extract it.

Do not be afraid to change existing code when the current shape is the problem. Avoid one-off local patches when a shared module or cleaner boundary is the real fix.

Do not code defensively by default. Prefer strong types and clear invariants over spreading `unknown`, redundant guards, or repeated output validation through the codebase.

## Testing Guidelines
Add or update tests when behavior changes materially  or shared logic is introduced. Do not add tests for every small refactor. Keep unit tests close to the code; keep workflow and UI-path validation in `tests/e2e`.
Never add tests to e2e unless specifically asked to.

## Commit & Pull Request Guidelines
Follow the existing commit style: short, imperative subjects like `Add ...`, `Remove ...`, or `Improve ...`. Keep pull requests focused. Include:

- what changed and why
- commands run for validation
- screenshots or recordings for renderer/UI changes
- linked issues or docs when relevant
