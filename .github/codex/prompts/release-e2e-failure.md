# Release E2E Failure Triage

You are analyzing a failed `release` branch GitHub benchmark E2E run for Control, an Electron desktop client for
GitHub.

Read these generated files first:

- `e2e-failures.md`
- `e2e-failures.json`

Then inspect the relevant Playwright benchmark tests, support drivers, and application code. Do not edit files or
propose broad refactors. Produce concise Markdown for a GitHub issue with:

1. The failing test, project, fixture, and scenario.
2. The most likely root cause, with file paths or symbols when the evidence supports it.
3. The smallest suggested fix.
4. The validation command or workflow that should be rerun.
5. Any uncertainty or missing artifact that limits confidence.

Keep the analysis specific to the recorded failure. Avoid generic CI advice unless it directly explains this run.
