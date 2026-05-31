# Markdown Rendering Baseline

This document records the parts of the old code and markdown rendering plan that
have shipped. The remaining code viewer work lives in
`docs/wip/code-viewer-upgrade.md`.

## Completed

- Markdown files opened from the code browser render as formatted markdown.
- Repository README panels render formatted markdown.
- Markdown rendering is display-only and does not execute raw HTML.
- Markdown links and images have a renderer-side resolution path.
- Relative repository markdown links can route back into Control for same-repo
  code navigation.
- Timeline comments use the shared markdown renderer where the product now
  expects formatted conversation content.
- Tests cover core markdown rendering, README rendering, and markdown URL safety.

## Current Baseline

The markdown renderer is custom and intentionally renderer-side. Future work can
replace or extend it, but should preserve these constraints:

- Do not execute raw HTML from repository content.
- Do not move markdown rendering into the main process.
- Keep link navigation explicit and auditable.
- Keep external URL opening behind the centralized external-link boundary.
