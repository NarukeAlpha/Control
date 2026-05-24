# Code Viewer Upgrade

The code viewer is partially improved, but it is not done. Markdown rendering is
usable; code rendering still needs a real display-only highlighting path,
predictable fallbacks, and broken-control cleanup.

## Current State

- Markdown files render as formatted documents.
- README panels render formatted markdown.
- Code files still render mostly as raw line spans.
- Line numbers are visible in the current file viewer.
- Syntax highlighting is not wired in.
- Large-file fallback rules are not implemented.
- Blame controls are still present in code paths even though blame behavior is
  not product-ready.

## Required Work

### Syntax Highlighting

- Choose and wire a syntax highlighting library.
- Use explicit filename and extension language mapping.
- Avoid automatic language detection.
- Keep rendering display-only; never rewrite, normalize, or format file content.
- Add a code theme hook that can later integrate with the theme system.

### Fallback Policy

- Define thresholds for skipping highlighting.
- Use plain text for unsupported languages.
- Use plain text for files larger than the chosen size or line-count threshold.
- Keep horizontal scrolling and avoid expensive soft-wrap recalculation for large
  files.
- Show a small non-blocking message when highlighting is skipped.

### Markdown And Code Block Integration

- Preserve the existing markdown renderer safety rule: do not execute raw HTML.
- Add `.mkdn` support if the older beta extension list is still desired.
- Decide whether markdown fenced code blocks should reuse the same code renderer.
- Keep repository-relative links auditable and test-covered.

### Blame And Diff

- Hide blame controls until blame behavior is correctly implemented.
- Remove or gate inactive blame fetches.
- Treat diff viewing as a separate research spike.
- Evaluate reuse of an existing diff viewer before building a custom one.

## Acceptance Criteria

- Supported code files render with syntax highlighting.
- Unsupported or large files fall back to plain text predictably.
- Markdown files still render formatted and safe.
- Broken blame controls are hidden or disabled without starting dead fetches.
- Tests cover file type detection, language mapping, markdown-vs-code rendering,
  and large-file fallback.

## Validation

Required before closing implementation work:

```bash
bun run test
bun run format
bun run lint
bun run typecheck
```
