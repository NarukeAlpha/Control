# Code Viewer Upgrade

The repository code viewer should move from raw file display toward a polished,
repository-native browsing experience. The first pass should improve syntax
rendering, file tree styling, and broken control visibility while leaving blame
and advanced diff viewing as deliberate follow-up decisions.

## Goals

- Render code with syntax highlighting instead of plain raw text.
- Keep markdown and code rendering display-only.
- Make the file tree match Control's visual system.
- Hide broken blame behavior until it is implemented correctly.
- Research a better diff viewer before committing to a custom implementation.

## File Rendering

Opened code files should render with syntax highlighting based on filename or
extension. The renderer should never rewrite, normalize, or format the file
contents. Highlighting is a presentation concern only.

Use explicit language mapping instead of automatic language detection. Automatic
detection can be expensive and unpredictable for large files.

Large or unsupported files should fall back to plain text. The thresholds should
favor predictable renderer performance over highlighting every file.

## File Tree And Path UI

The repository file structure should feel like part of Control rather than a
bare list of text. The file tree should use the app's spacing, hover states,
selected states, icons, and typography.

The path/breadcrumb area should be cleaned up with the same goal:

- readable current path
- clear folder/file affordances
- no fallback GitHub icon that does not perform a meaningful action
- stable layout when paths are long

## Markdown Rendering

Markdown files should render as formatted documents when opened from the code
viewer. This overlaps with the existing code and markdown rendering plan, so the
implementation should reuse that direction rather than creating a separate
renderer path.

Markdown rendering should not execute raw HTML.

## Blame

The current blame path should be hidden if it is not correctly implemented.
Known broken behavior, such as "no type blob for blame", should not remain
visible as a normal user control.

Future blame options:

- open a dedicated blame route for the current blob
- render inline blame beside code lines, similar to GitHub
- show blame metadata on hover or selection

Inline blame is likely the better long-term experience, but it should not be
bundled into the first syntax-highlighting pass.

## Diff Viewer Research

Diff viewing should be a research spike before implementation. Evaluate whether
Control can reuse an existing diff viewer from the Pierce repository, especially
if it includes a diff.com-style viewer that can be adapted without embedding
diff.com itself.

Also evaluate the IntelliJ-style fluid diff experience as the target quality
bar:

- clear changed-line grouping
- strong line-number affordances
- readable inline changes
- smooth side-by-side and unified presentation
- no cramped or raw patch-like default for normal review

The research outcome should recommend one of:

- reuse and adapt an existing diff viewer
- adopt a maintained open-source diff rendering library
- build a Control-specific viewer after proving the requirements are unique

## Out Of Scope

- Implementing blame in the first pass.
- Implementing a full PR review experience.
- Changing GitHub provider payloads unless needed for file metadata.
- Adding e2e tests unless specifically requested.

## Acceptance Criteria

- Code files render with syntax highlighting when supported and small enough.
- Large or unsupported files fall back to plain text predictably.
- Markdown files render as formatted markdown when opened.
- File tree and path UI match the Control visual system.
- Broken blame controls are hidden.
- Diff viewer direction is documented before implementation begins.

## Validation

Add or update renderer tests for file type detection, language mapping,
markdown-vs-code rendering, and large-file fallback behavior where practical.

Required validation before closing implementation work:

- `bun run test`
- `bun run format`
- `bun run lint`
- `bun run typecheck`
