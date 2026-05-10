# Code and Markdown Rendering Plan

Control's code browser currently renders opened files as raw text inside
`<pre><code>` and the repository code tab shows a compact README summary card.
This plan upgrades the renderer so code is easier to read and markdown files
render as formatted documents instead of raw source.

The work stays renderer-only. It must not mutate fetched file contents, cached
SQLite data, or any GitHub provider payloads.

## Goals

- Add display-only syntax highlighting for opened code files.
- Render opened markdown files as formatted markdown instead of raw text.
- Reuse the markdown renderer for the repository code-tab README panel.
- Keep same-repo markdown links navigable inside Control.
- Open external links in the system browser.
- Preserve predictable performance for large files.

## Renderer Approach

Add renderer dependencies for markdown and syntax highlighting:

- `react-markdown`
- `remark-gfm`
- `rehype-slug`
- `prismjs`

Extract file rendering into small renderer-focused modules instead of keeping
all branching inside `App.tsx`:

- `FileContentRenderer` chooses markdown, highlighted code, or plain-text
  fallback based on file type and size.
- `MarkdownRenderer` renders markdown surfaces and handles link and image
  behavior.
- `fileRendering` utilities centralize extension detection, language mapping,
  relative-link resolution, and large-file fallback checks.

Keep the shared and main-process contracts unchanged. The renderer already has
the file name, path, ref, and raw text needed to decide how to present the
content.

## Code File Rendering

For non-markdown files, add syntax highlighting in the code browser with these
rules:

- Highlight on the render side only. Never rewrite, normalize, or format the
  underlying file text.
- Use explicit filename and extension mapping to select a Prism language.
- Do not use language auto-detection.
- Do not add line numbers in this pass.
- Keep the existing horizontal-scroll code layout instead of enabling soft wrap
  by default.

When highlighting is not appropriate, fall back to plain text:

- file size over `200 KB`
- file length over `5,000` lines
- unsupported or unknown language mapping

This preserves predictable renderer performance and avoids turning large file
opens into expensive client-side work.

## Markdown Rendering

Treat these extensions as markdown:

- `.md`
- `.markdown`
- `.mdown`
- `.mkdn`

Render markdown with GFM support and no raw HTML execution. Reuse the shared
code block renderer so fenced code blocks inside markdown get the same code
presentation as the normal code viewer when the content is small enough.

Apply the markdown renderer in two places:

- opened markdown files in the code browser
- the repository code-tab README panel

Do not convert issue, pull request, or discussion comments to full markdown in
this pass. Those surfaces can stay on the existing plain-text path until the
new renderer is proven out in file viewing.

## Link and Image Behavior

Markdown links should follow Control-specific routing rules:

- same-repo links should open inside Control
- non-GitHub external links should open through `openExternal`
- cross-repo GitHub links should stay external in v1

For same-repo relative links:

- resolve the target against the current markdown file path and current `ref`
- if the target is clearly a blob or tree URL, route directly using the
  existing `openCodeBrowser` store action
- if the target is ambiguous, probe file content once to distinguish file from
  directory before navigating

For markdown images:

- resolve relative image paths against the current repo and ref
- render them using GitHub raw URLs
- leave external image URLs untouched

## README Panel Changes

Replace the current compact README summary card in the repository code tab with
a full rendered README preview using the shared markdown renderer.

Keep the surrounding card container, but make the body behave like a real
document preview instead of a heading plus excerpt. The rendered README should
still inherit the existing repository page layout and should not require any
backend or storage changes.

## Public Interfaces

No shared API changes are needed:

- no `RepoFileContent` changes
- no IPC channel changes
- no SQLite schema changes
- no GitHub provider changes

Only renderer-internal props and utilities should change so the markdown
renderer can receive repository context, current ref, current file path, and
navigation callbacks.

## Test Plan

Add or update renderer tests for:

- opening `README.md` in the code browser renders formatted markdown instead of
  raw `#` text
- the repository README panel renders full markdown content
- same-repo markdown link clicks navigate through `useUiStore`
- external markdown link clicks call `openExternal`

Add unit coverage for the shared renderer utilities:

- markdown extension detection
- filename and extension language mapping
- repo-relative link resolution from root and nested markdown files
- large-file plain-text fallback thresholds

Validation after implementation:

- `bun run test`
- `bun run format`
- `bun run lint`
- `bun run typecheck`

Do not add end-to-end coverage in this pass.

## Assumptions

- "Formatting" means display-only highlighting and presentation polish, not
  rewriting file contents.
- Same-repo markdown navigation should preserve the currently viewed `ref`.
- Raw embedded HTML inside markdown is intentionally unsupported in the first
  pass for safety and predictability.
