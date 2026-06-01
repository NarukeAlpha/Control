# Validation, Dead Code, And Tooling Cleanup

## Scope

This plan covers issues surfaced by repository diagnostics rather than a single runtime path. The goals are stable
validation, fewer stale surfaces, accurate dependencies, and a build output that stays intentional.

## DEAD-01: Remove Or Reown The Stale File Blame Renderer Surface

### Current Evidence

- `bunx knip --reporter compact` reports `src/renderer/src/components/repository/FileBlamePanel.tsx` as an unused file.
- The panel still exports UI:
  - `src/renderer/src/components/repository/FileBlamePanel.tsx:10` exports `expandedFileBlameRangeLimit`.
  - `src/renderer/src/components/repository/FileBlamePanel.tsx:12` exports `FileBlamePanel`.
- Styles still exist:
  - `src/renderer/src/styles.css:2438` starts `.file-blame-panel`.
  - `src/renderer/src/styles.css:2442-2500` keeps blame range row styles.
- Query invalidation still includes blame:
  - `src/renderer/src/queries/repositoryQueryKeys.ts:1` defines `repositoryScopedQueryKeyPrefixes`.
  - `src/renderer/src/queries/repositoryQueryKeys.ts:8` includes `"file-blame"`.
- Completed docs already say the active code-browser path stopped rendering blame:
  - `docs/done/code-viewer-upgrade.md:427-444` says to stop rendering/fetching blame and leave the wider blame stack
    only if other work still depends on it.

### Failure Mode

The active UI no longer owns `FileBlamePanel`, but the component, CSS, query invalidation, shared/provider types, and
IPC route still imply a feature surface. That creates dead-code noise and makes future code-browser work harder to
reason about.

### Proposed Change

Pick one path:

1. Delete stale renderer blame UI:
   - remove `FileBlamePanel.tsx`
   - remove `.file-blame-panel` and `.blame-*` CSS if no other component uses it
   - remove `file-blame` from renderer repository invalidation if no active query uses it
   - keep provider/shared IPC only if external or future work still needs it
2. Or reown blame as an active feature:
   - add a visible route/panel owner
   - restore lazy query behavior
   - add tests for range expansion and external fallback

The cleanup should not leave the current middle state.

### Verification

- `bunx knip --reporter compact` no longer reports `FileBlamePanel.tsx` as unused.
- `rg -n "FileBlamePanel|file-blame|blame-range" src/renderer/src` shows either no stale renderer references or a real
  active owner.
- `bun run test -- src/renderer/src/components/code-browser`

## TOOL-05: Verify Rust `target/` Output Cannot Break Formatting

### Current Evidence

- `.gitignore:1-12` ignores JavaScript/Electron output such as `node_modules`, `out`, `dist`, `release`, coverage, and
  Playwright output.
- There is no `.prettierignore` in the current worktree.
- A previous audit report observed `bun run format:check` scanning generated Cargo files under
  `target/debug/.fingerprint` after Rust gateway builds.
- The current verification run did not reproduce an untracked `target/` directory, and `bun run format:check` passed.

### Failure Mode

If Cargo output is generated at the repository root and not ignored by Prettier, formatting validation can fail on
generated Rust build artifacts. That would make `cargo test` and `bun run format:check` order-dependent.

### Proposed Change

1. Reproduce intentionally:
   - remove any existing generated Cargo output.
   - run `cargo test`.
   - run `git status --short`.
   - run `bun run format:check`.
2. If `target/` appears at the repository root or Prettier scans generated Cargo output, add ignore coverage:
   - `.gitignore`: `target/` and `crates/**/target/`
   - `.prettierignore`: `target/` and `crates/**/target/`
3. If Cargo output remains outside the repo or is already ignored by tooling, document the reproduction result and close
   this as not currently actionable.

### Verification

- `cargo test`
- `git status --short` shows no untracked root `target/`, or ignore files intentionally cover it.
- `bun run format:check` passes after `cargo test`.

## TOOL-01: Add Or Remove The Direct Playwright Dependency

### Current Evidence

- Benchmark support imports from `playwright` directly:
  - `tests/e2e/benchmarks/support/drivers.ts:2` imports `_electron`, `ElectronApplication`, `Locator`, and `Page` from
    `"playwright"`.
- `package.json` only lists `@playwright/test`:
  - `package.json:71` starts `devDependencies`.
  - `package.json:73` includes `@playwright/test`.
  - `package.json:93` ends without a direct `playwright` entry.
- `bunx knip --reporter compact` reports `Unlisted dependencies: tests/e2e/benchmarks/support/drivers.ts: playwright`.

### Failure Mode

The benchmark harness relies on a transitive dependency. Package managers may not guarantee the transitive package shape
forever, and dependency hygiene diagnostics will keep failing.

### Proposed Change

1. Add `playwright` as a direct `devDependency` pinned to the same version family as `@playwright/test`, or change the
   import to a supported direct dependency if the project decides not to depend on `playwright`.
2. Keep `package-lock.json` and `bun.lock` synchronized.
3. Re-run Playwright install/repair if adding the direct package affects browser binaries.

### Verification

- `bunx knip --reporter compact` no longer reports unlisted `playwright`.
- `bun run test:e2e -- --list` or the smallest benchmark listing command can load the benchmark support module.

## TOOL-02: Fix Dev Dependency Vulnerabilities Without Changing Runtime Risk

### Current Evidence

- `npm audit --omit=dev` reports `0 vulnerabilities`.
- `npm audit` reports:
  - `brace-expansion 5.0.2 - 5.0.5`, moderate severity.
  - `tmp <0.2.6`, high severity.
- The fix is available through `npm audit fix`.

### Failure Mode

Runtime dependencies are clean, but dev tooling still carries known vulnerable packages. This may block CI policy or
make local tooling riskier than necessary.

### Proposed Change

1. Run the package-manager-approved update path:
   - start with `npm audit fix`
   - refresh `bun.lock` through the repo's Bun install path
2. Inspect resulting lockfile changes. Do not allow surprise runtime dependency upgrades.
3. Keep a short note in the PR explaining that runtime audit was already clean and this is dev-tree hygiene.

### Verification

- `npm audit`
- `npm audit --omit=dev`
- `bun install --frozen-lockfile` or the repo's chosen Bun lock validation path once command ownership is clarified.
- `bun run test`

## TOOL-03: Align Command Documentation And Package Scripts With The Agent Path

### Current Evidence

- AGENTS requires Bun validation for agents.
- `README.md` leads with npm:
  - `README.md:9-12` shows `npm install` and `npm run dev`.
  - `README.md:37-43` lists npm validation commands.
- `package.json` still shells through npm inside scripts:
  - `package.json:14` has `build: "npm run typecheck && electron-vite build"`.
  - `package.json:19-22` package scripts call `npm run ...`.
  - `package.json:31-45` GitHub benchmark scripts call `npm run build`.
- Playwright web servers use npm:
  - `playwright.config.ts:20` uses `npm run dev:renderer -- --port 5173`.
  - `playwright.github.config.ts:32` uses `npm run dev:renderer -- --port 5174`.
- `docs/README.md:10` describes `cleanup` as historical, but this folder now contains active remediation docs.

### Failure Mode

Humans, agents, and CI can run different package-manager paths. That increases lockfile drift and makes validation
failures harder to reproduce.

### Proposed Change

1. Decide the canonical local command path:
   - if Bun is canonical for agents and local validation, make README lead with Bun.
   - if npm remains canonical for dependency installation, document the split explicitly and keep scripts compatible.
2. Avoid nested `npm run` inside scripts that are expected to be invoked by `bun run`; prefer direct script commands or
   Bun-compatible invocations.
3. Update Playwright webServer commands to the chosen path.
4. Update `docs/README.md` so `cleanup` means active cleanup/remediation plans, not historical cleanup plans.

### Verification

- `bun run build`
- `bun run test:e2e -- --list` or a lightweight Playwright listing command.
- README and docs index no longer contradict AGENTS.

## TOOL-04: Make React Doctor Follow-Up Actionable Instead Of Noisy

### Current Evidence

`react-doctor . --offline --verbose` reported 428 issues across 128 files. The broad categories included:

- unused exports/types through Knip integration
- combine-iteration warnings
- async-await-in-loop and async-parallel warnings
- `no-giant-component`
- `prefer-useReducer`
- derived state from props
- missing query invalidation
- accessibility issues in `AreaTopbarSelector`

### Failure Mode

The report is too broad to fix opportunistically. If left untriaged, it becomes background noise and developers ignore
the genuinely important warnings.

### Proposed Change

1. Create a checked-in triage snapshot or issue list that groups warnings into:
   - must fix now: stale query invalidation, accessibility violations, giant production components already touched
   - opportunistic: simple combine-iteration and immutable sort improvements
   - ignore/defer with reason: test-only sequential awaits, progressive enhancement warnings that do not apply to
     Electron forms
2. Add a lightweight script only if the team wants React Doctor as a recurring gate. Do not fail CI on all current
   warnings until the baseline is reduced.
3. Fold giant component and inline callback work into `RENDER-04` and `RENDER-06`.

### Verification

- A future `react-doctor . --offline --verbose` run has an owner and threshold.
- Known false positives are documented with reasons, not silently ignored.

## PERF-01: Reduce Shiki Bundle Output Pressure

### Current Evidence

- Runtime code dynamically imports all of Shiki:
  - `src/renderer/src/components/code-browser/codeHighlighter.ts:21` defines `getCodeHighlighter`.
  - `src/renderer/src/components/code-browser/codeHighlighter.ts:23` runs `import("shiki")`.
  - `src/renderer/src/components/code-browser/codeHighlighter.ts:24-28` creates a highlighter with one theme and
    no initial languages.
  - `src/renderer/src/components/code-browser/codeHighlighter.ts:40` loads the requested language.
- Production build output currently emits a large language/theme asset set:
  - `out/renderer/assets/index-YQ9Dk_d2.js` around 2.1 MB.
  - `out/renderer/assets/emacs-lisp-DbZW1X_J.js` around 780 kB.
  - `out/renderer/assets/cpp-B-e1Rzcy.js` around 626 kB.
  - `out/renderer/assets/wasm-DDgzZJey.js` around 622 kB.
  - `out/renderer/assets` around 12 MB in the current build.

### Failure Mode

The code viewer only needs a small subset of languages initially, but the bundler is producing hundreds of Shiki chunks.
That increases packaged app size and can slow update/install paths.

### Proposed Change

1. Define the supported language set in code viewer policy.
2. Import only the languages and theme needed for that set, or route highlighting through a worker/lazy chunk with an
   explicit allowlist.
3. Add a fallback for unknown languages that uses plain text instead of loading arbitrary grammar chunks.
4. Track build asset size before and after.

### Verification

- `bun run build`
- `find out/renderer/assets -type f | wc -l`
- `du -sh out/renderer/assets`
- Manual code viewer smoke test for TypeScript, Markdown, JSON, Rust, and plain text.

## DEAD-02: Triage Knip Unused Exports Instead Of Ignoring The Whole Report

### Current Evidence

`bunx knip --reporter compact` reported:

- unused files:
  - `electron.vite.config.ts`
  - `src/main/index.ts`
  - `src/renderer/src/components/repository/FileBlamePanel.tsx`
- unused dependency:
  - `electron-liquid-glass`
- unlisted dependency:
  - `playwright`
- many unused exports/types in tests, shared contracts, mocks, and tab query helpers.

Some of these are false positives or tool-configuration issues:

- `src/main/index.ts` is the Electron entry configured through package/build tooling.
- `electron-liquid-glass` is imported by `src/main/index.ts`.
- `electron.vite.config.ts` may be used by Electron Vite even if Knip does not detect the config file.

### Failure Mode

The useful findings are mixed with false positives. Without configuration, future Knip output will keep reporting the
same known-good entry points and hide real stale code.

### Proposed Change

1. Add Knip configuration for Electron/Vite entry points and config files if the project wants Knip as a regular tool.
2. Handle real findings separately:
   - `DEAD-01` for FileBlamePanel.
   - `TOOL-01` for unlisted Playwright.
3. Review unused exports in source modules before deletion. Many shared exported types may be public IPC contracts or
   test helpers.
4. Avoid deleting exports solely because Knip reports them if they are part of an intended boundary.

### Verification

- `bunx knip --reporter compact`
- Remaining findings are either fixed or documented as intentional Knip config exceptions.
