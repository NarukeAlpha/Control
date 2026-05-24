# Code Viewer Upgrade

This is the pass-1 implementation plan for making the in-app GitHub code
browser reliable enough to use as a display-only file viewer. Markdown rendering
already has a safe baseline; the remaining work is code rendering, explicit file
state handling, and removing unfinished blame behavior from the active path.

The plan is intentionally scoped to the GitHub-backed code browser. Local Area
file viewing has a different `AreaFileContent` contract in `src/shared/areas.ts`
and should not be folded into this pass unless the implementation discovers a
shared renderer-only helper that can be reused without changing Area IPC.

## Current Ground Truth

- `src/renderer/src/components/code-browser/CodeBrowserPage.tsx` owns the
  current file viewer UI. Code files render as raw line spans inside
  `.code-line-viewer`; markdown files render through `MarkdownBody`; images use
  `downloadUrl`; binary fallback is renderer-only and extension/null-byte based.
- `src/renderer/src/components/code-browser/codeBrowserUi.tsx` owns file icon
  mapping, markdown path detection, previewable image detection, binary
  detection, path encoding, and line-number normalization.
- `src/renderer/src/components/code-browser/codeBrowserQueries.ts` owns the
  React Query keys and fetches file content, file blame, file commits, directory
  contents, and file-finder tree data for the code-browser route.
- `src/shared/github.ts` defines `RepoFileContent` as text-only:
  `content: string` plus URLs and last-commit metadata. It does not expose file
  size, encoding, binary state, or skipped-preview state.
- `src/main/github/repositoryDomain.ts` implements `getFileContent` by fetching
  raw text from `GET /repos/{owner}/{repo}/contents/{path}` with
  `accept: application/vnd.github.raw`, in parallel with last-commit metadata.
  That means the provider currently cannot reject large or binary files before
  downloading content.
- `src/main/ipc/registerControlIpc.ts`, `src/preload/index.ts`, and
  `src/shared/ipc.ts` already expose `getFileContentWithStatus`; no new IPC
  channel is needed for this pass unless a separate raw-download operation is
  added later.
- `src/renderer/src/components/MarkdownBody.tsx` is a custom renderer. It does
  not execute raw HTML, only opens safe `https:` URLs, and has tests in
  `src/renderer/src/components/MarkdownBody.test.tsx`.
- `docs/done/markdown-rendering-baseline.md` records the shipped markdown
  baseline and should be treated as a constraint: markdown rendering stays in
  the renderer, remains display-only, and keeps link navigation explicit.
- Blame is not product-ready. The UI still shows a `Blame` toolbar button and
  renders `FileBlamePanel`; `useCodeBrowserQueries` and `refreshCodeBrowserData`
  always fetch blame for file routes.

## Implementation Decision

Use Shiki for syntax highlighting in the renderer only, behind a lazy-loaded
singleton. Shiki matches the VS Code grammar/theme model and supports
browser/runtime use, but it must not be imported eagerly into the main renderer
bundle.

Add Shiki as an application dependency only when implementing the feature. Use
the repo's Bun-managed dependency flow, for example `bun add shiki`, then inspect
`package.json`, `bun.lock`, and `package-lock.json` so any manifest or lockfile
changes are intentional. Validation still uses the repository scripts through
`bun run`.

Concrete constraints:

- Do not auto-detect languages from content.
- Map language from filename/extension only.
- Do not mutate, normalize, trim, or format repository file content.
- Do not send highlighted HTML over IPC.
- Use Shiki token or HAST output rendered as React elements. Do not use Shiki's
  default raw HTML string output for repository content. Acceptable APIs include
  `codeToTokensBase` with a custom token-to-`<span>` renderer, or `codeToHast`
  with a small recursive React renderer that escapes text nodes and maps only
  known element/tag/style fields.
- The renderer token model must preserve the source string exactly at copy time.
  Tokenization can split display into lines and spans, but it must preserve
  original whitespace, empty lines, and trailing-newline behavior from the raw
  `content` string. The React path should never require `dangerouslySetInnerHTML`
  for repository text; still add a test with HTML-like source such as
  `<script>alert(1)</script>` to prove it renders as text.
- Use a long-lived highlighter singleton and load languages/themes on demand.
- Verify Shiki's browser engine assets under Electron Vite before landing the
  dependency. If the chosen Shiki path needs the Oniguruma WASM asset, update
  `electron.vite.config.ts` or the Shiki import strategy so the renderer can
  load the WASM file in both `bun run dev` and packaged production builds.
  Prefer a Shiki JavaScript engine only if it preserves required grammar support
  and avoids a WASM asset entirely. Add one packaged-build smoke check to the
  implementation notes before calling syntax highlighting complete.
- Keep the first theme local to the code viewer, with names/classes that can be
  connected to the future theme system later.

## Target Architecture

### Renderer Modules

Add small renderer-owned modules under
`src/renderer/src/components/code-browser/`:

- `codeLanguage.ts`
  - Exports `languageForCodePath(path: string): CodeLanguage | null`.
  - Owns explicit filename and extension mapping.
  - Reuses no content sniffing.
  - Includes tests for case-insensitive filenames, extensionless special files,
    markdown extensions, shell scripts, and unsupported files.
- `codeViewerPolicy.ts`
  - Exports renderer-only preview/highlight decisions that compose shared file
    policy with route/UI concerns.
  - Owns max rendered lines, max highlight bytes/lines, max line-numbered lines,
    and UI-specific status decisions.
  - Re-exports or wraps shared markdown/image/binary helpers only when that
    keeps existing imports readable.
- `codeHighlighter.ts`
  - Owns lazy Shiki import, singleton creation, theme/language loading, and
    tokenization.
  - Does not import Electron, IPC, React Query, or repository state.
  - Returns a renderer-friendly token model, not JSX tied to a route.
- `CodeSourceView.tsx`
  - Owns code rendering for text files.
  - Accepts `content`, `path`, `highlightedLine`, `fileSize`, and optional
    precomputed `language`.
  - Renders line numbers, highlighted route line, copy-safe raw text, and
    fallback notices.
  - Handles async highlight state without blocking the plain-text render.
  - Uses `.code-line-viewer`/`.code-source-line` semantics or direct successors
    so existing CSS concepts remain recognizable.

Then simplify `CodeBrowserPage.tsx` so it only decides which preview kind is
active: image, markdown, binary/unavailable/too-large fallback, or
`CodeSourceView`.

### Shared Preview Policy

Provider-used file policy must not live under `src/renderer`. Add a small shared
module, for example `src/shared/filePreviewPolicy.ts`, for serializable policy
that is safe to import from both `src/main` and `src/renderer`:

- `maxPreviewBytes`
- markdown extension and filename helpers
- previewable image extension helpers
- binary extension helpers that explicitly exclude previewable images
- null-byte text rejection helper, or a pure helper that can be used after raw
  bytes/text are fetched

Renderer-only thresholds such as `maxRenderedLines`, `maxHighlightBytes`,
`maxHighlightLines`, and `maxLineNumberedLines` stay in renderer policy because
they describe DOM and highlighter cost, not provider fetch eligibility.

Tests should prove the shared helper alignment that matters across boundaries:
previewable images are not classified as generic binary files, markdown
extensions match the code-browser UI, and provider binary decisions stay in sync
with renderer fallback expectations.

### Shared Contract And Provider Boundary

Change the existing `RepoFileContent` contract instead of adding parallel IPC.
The provider needs enough metadata to avoid downloading and rendering files that
should not be previewed.

Add an explicit state shape in `src/shared/github.ts`. Suggested shape:

```ts
export type RepoFileContentKind = "text" | "image" | "binary" | "too_large" | "unavailable";

export interface RepoFileContent {
  path: string;
  name: string;
  ref: string | null;
  kind: RepoFileContentKind;
  content: string | null;
  size: number | null;
  encoding: "utf-8" | null;
  htmlUrl: string;
  downloadUrl: string | null;
  message: string | null;
  // existing last-commit fields stay unchanged
}
```

Implementation notes:

- `kind: "text"` is the only state with non-null `content`.
- `kind: "image"` means the file exists, is previewable by extension, and should
  render through `downloadUrl` without fetching or copying raw text. This
  resolves the current overlap where `avif`, `gif`, `jpeg`, `jpg`, `png`, `svg`,
  and `webp` are both image-previewable and binary-like.
- `kind: "binary"` means the file exists but should not render as text and is
  not an image preview.
- `kind: "too_large"` means the app intentionally skipped downloading or
  rendering the body because it exceeded policy.
- `kind: "unavailable"` is for provider failures that still have useful file
  metadata. Full request failures should continue to use
  `RepoFileContentResult.availability`.
- `encoding: "utf-8"` means the provider successfully decoded and validated the
  exact text body as UTF-8. All non-text states use `encoding: null`. If the
  provider cannot safely represent the body as UTF-8, return `kind: "binary"`
  for null-byte/binary-looking content or `kind: "unavailable"` with a message
  for decode failures where metadata is otherwise usable.
- Preserve `downloadUrl`, `htmlUrl`, and last-commit metadata whenever they are
  known, even when `content` is null.
- Update `src/renderer/src/test/factories/controlApi.tsx`,
  `src/renderer/src/data/mocks/contents.ts`,
  `src/renderer/src/components/repository/repositoryTabPrefetch.test.ts`, and
  tests that construct `RepoFileContent` or `RepoFileContentResult` manually.
- Update existing consumers outside `CodeBrowserPage.tsx`:
  `src/renderer/src/components/repository/code/CodeTab.tsx` must pass markdown
  to `MarkdownBody` only when root markdown content is `kind: "text"` with
  non-null `content`; otherwise it should show the existing unavailable/empty
  treatment with the provider message when present.
  `repoFileContentRecentCommit` should continue to accept `RepoFileContent`,
  but tests should cover non-text states because commit metadata still applies.

In `src/main/github/repositoryDomain.ts`, split content loading into metadata
and body decisions:

1. Fetch content metadata with the regular GitHub Contents API accept header.
   Use this to read `type`, `name`, `path`, `size`, `html_url`, `download_url`,
   `encoding`, and API-provided content fields. Extend `GitHubContentItem` with
   `content?: string | null` and `encoding?: string | null` before relying on
   those fields.
2. If the item is not a file, return `kind: "unavailable"` with a message.
3. If `size` exceeds the max preview byte threshold, return
   `kind: "too_large"` without fetching raw content.
4. If filename/extension indicates a previewable image, return `kind: "image"`
   without fetching raw content.
5. If filename/extension indicates non-image binary content, return
   `kind: "binary"` without fetching raw content. Keep the existing null-byte
   check as a post-fetch safety net for files whose extension is misleading.
6. Fetch raw text only for files still eligible for text preview.
7. Preserve cache-only and force-refresh behavior through the existing provider
   and read-cache path. Do not add renderer-side fetches to `downloadUrl`.

Raw-body rules:

- Prefer raw body fetching for eligible text files so copy uses the exact text
  served for the file body, including original newlines. Keep the raw request's
  `accept: application/vnd.github.raw` header.
- Use the JSON Contents `content` field only as a fallback when the raw body
  request is not possible and `encoding === "base64"`. Decode it as bytes, then
  validate UTF-8 before producing `kind: "text"`. Validation must be strict:
  use `TextDecoder("utf-8", { fatal: true })` or an equivalent byte-level check.
  Do not use `Buffer.toString("utf8")` as the validator because it silently
  replaces invalid bytes and can misclassify binary files as garbled text.
- Treat `encoding: "none"`, an unsupported encoding, invalid base64, or invalid
  UTF-8 as non-previewable. Return `kind: "unavailable"` with a clear message if
  metadata is usable but the text body cannot be represented safely.
- A missing `download_url` does not by itself make text unavailable because the
  Contents raw endpoint may still work. It does disable `Open raw`/`Download`
  actions in the renderer unless another raw URL is known.
- Do not synthesize `downloadUrl` differently in the renderer. If the provider
  synthesizes a fallback raw URL, do it in one provider helper and cover it with
  tests.

Partial provider states:

- Metadata succeeds and raw body fetch fails: return `kind: "unavailable"`,
  `content: null`, preserve `htmlUrl`, `downloadUrl`, `size`, and a body-fetch
  failure message.
- Metadata succeeds and last-commit lookup fails: return the correct content
  `kind`; keep `lastCommitAvailability` as the mapped error and use empty commit
  metadata.
- Metadata item type is `dir`, `symlink`, or `submodule`: return
  `kind: "unavailable"`, `content: null`, preserve known URLs, and explain that
  the item is not a regular file.
- Raw fetched content contains a null byte: return `kind: "binary"`,
  `content: null`, preserve known URLs and commit metadata, and set a message
  explaining that binary-looking content is not previewed.
- Missing `download_url`: preserve `downloadUrl: null`; image/binary/too-large
  states still render fallbacks, but raw actions stay disabled.
- Full metadata request failure: keep `item: null` and map the failure through
  `RepoFileContentResult.availability`.

Keep `registerControlIpc.ts` validation focused on repo/path/ref/maxRanges.
The new file-state fields are output-only and do not need IPC parser changes.

`src/main/github/octokitProvider.test.ts` also needs updates. Replace any test
that assumes file content is fetched only through a raw request with expectations
that metadata-first loading performs a JSON Contents request first, and that raw
body fetches still use `accept: application/vnd.github.raw` only when the
provider decides the file is eligible for text preview.

### File-State Rendering

`CodeBrowserPage.tsx` should stop inferring all state from `content` and
extension alone. Use the provider `kind` first, then renderer preview helpers:

- `kind: "image"` plus previewable image extension: image preview using
  `downloadUrl`; if `downloadUrl` is missing, show an image-unavailable fallback
  rather than a binary fallback.
- `kind: "text"` plus markdown extension: markdown preview using
  `MarkdownBody`.
- `kind: "text"` plus non-markdown code/text: `CodeSourceView`.
- `kind: "binary"`: binary fallback with `Open raw`/`Download` enabled when
  `downloadUrl` exists, `Copy raw` disabled.
- `kind: "too_large"`: large-file fallback explaining that preview was skipped,
  with file size when known and raw actions enabled when possible.
- `kind: "unavailable"` or `availability` unavailable: existing error-state
  treatment, but keep stale cached content visible when React Query has data and
  background refresh fails.

Cache/stale behavior:

- A successful fresh read that returns `kind: "image"`, `kind: "binary"`,
  `kind: "too_large"`, or `kind: "unavailable"` replaces any older cached text
  preview for the same query key.
- Stale cached text remains visible only when React Query already has data and a
  background refresh fails at the query/status layer.
- Provider cache entries under `file-content-with-status:*` should be treated as
  whole-result snapshots. Tests must cover an old cached `kind: "text"` result
  being replaced by a successful fresh `kind: "too_large"` or `kind: "binary"`
  result when `forceRefresh` succeeds.

Copy behavior:

- `Copy raw` is enabled only for `kind: "text"` with non-null `content`.
- Copy must copy the exact raw content string returned by the provider.
- Copy status remains an `aria-live` status as it is today.

## Language Mapping

Start with the languages this app is most likely to show in its own repository
and common GitHub projects. Unsupported languages must render as plain text.

Filename mapping:

- `Dockerfile` -> `dockerfile`
- `Containerfile` -> `dockerfile`
- `Makefile` -> `make`
- `CMakeLists.txt` -> `cmake`
- `.gitignore`, `.gitattributes`, `.gitmodules` -> `git-commit` or plain text
  if Shiki does not provide the exact grammar cleanly.
- `package.json`, `tsconfig.json`, `composer.json` -> `json`
- `bun.lock`, `bun.lockb`, package lockfiles -> plain text unless a safe grammar
  is already available.

Extension mapping:

- Web/TypeScript: `ts`, `tsx`, `js`, `jsx`, `mjs`, `cjs`, `json`, `jsonc`,
  `css`, `scss`, `html`
- Markdown/config: `md`, `markdown`, `mdown`, `mkd`, `mkdn`, `mdx`, `yml`,
  `yaml`, `toml`, `xml`
- Shell: `sh`, `bash`, `zsh`
- Common languages: `py`, `rb`, `go`, `rs`, `swift`, `c`, `h`, `cpp`, `hpp`,
  `java`, `kt`, `php`, `sql`

Do not map by shebang in this pass. Shebang detection is content sniffing and
can be added later if it is worth the extra policy complexity.

## Highlight And Large-File Policy

Use the shared preview policy for provider fetch eligibility and the renderer
policy for DOM/highlighter cost decisions. Initial thresholds:

- `maxPreviewBytes`: `2 * 1024 * 1024`
- `maxRenderedLines`: `20_000`
- `maxHighlightBytes`: `300 * 1024`
- `maxHighlightLines`: `5_000`
- `maxLineNumberedLines`: `20_000`

Behavior:

- Files above `maxPreviewBytes` return `kind: "too_large"` from the provider
  and do not download raw text.
- Text files above `maxRenderedLines` after fetch render a large-file fallback
  instead of creating tens of thousands of line DOM nodes. Keep raw actions
  available.
- Text files above either highlight threshold render plain text with line
  numbers and a small non-blocking status that says highlighting was skipped for
  a large file.
- Unsupported languages render plain text with line numbers and a status:
  `Syntax highlighting unavailable for this file type.`
- Highlight failures render plain text and a status:
  `Syntax highlighting failed. Showing plain text.`
- Long lines keep horizontal scrolling. Do not enable soft wrap by default.
- Highlighting is an enhancement. Plain text should appear first, then tokens
  can replace it after async loading if the file still matches the active route.
- Route-line highlighting from `normalizeCodeLineNumber` must remain stable when
  async tokenization replaces the initial plain-text view.
- If automatic scroll-to-line is implemented, it must run deterministically
  after the rendered line exists and must not move focus. Use instant scrolling,
  or gate smooth scrolling behind the app's reduced-motion policy.

Performance risks to handle:

- Shiki startup and WASM loading can be slow on first use. Lazy-load on first
  eligible code file, and keep the highlighter singleton alive.
- Electron Vite must know how to serve or bundle any required Shiki engine/WASM
  asset. Validate the renderer build output and packaged asset path, not only
  the dev server, because Shiki can work in development while failing after
  packaging if `.wasm` is emitted to an unexpected URL.
- Rapid route changes can resolve old highlight promises late. Guard async
  updates with a request key built from `owner/repo/ref/path/content`.
- Token rendering can create many spans. Enforce highlight line and byte limits
  before calling Shiki.
- React Query should cache file content, not highlighted token trees.
- Do not run syntax highlighting for markdown previews, images, binary files,
  large-file fallbacks, or hidden routes.

## Markdown Rendering

Preserve the shipped markdown baseline:

- Keep using `MarkdownBody` for markdown file previews and README/root markdown
  panels.
- Do not execute raw HTML.
- Keep safe-link logic in `MarkdownBody` and
  `markdownRepositoryUrlContext`.
- Add `.mkdn` to the markdown extension set if it remains desired. The current
  set is `md`, `markdown`, `mdown`, `mdx`, and `mkd`.
- Keep repository-relative links auditable. Same-repository markdown navigation
  should continue through the existing `MarkdownUrlHandlerContext` path rather
  than direct renderer navigation.

Fenced code blocks:

- Do not block the file-viewer upgrade on highlighted markdown fences.
- In this pass, keep fenced blocks plain unless adding a shared code-block
  renderer is trivial after `CodeSourceView` exists.
- If fenced block highlighting is added, reuse `languageForCodePath` only for
  explicit fence language labels and enforce a much smaller per-block threshold
  such as `20_000` bytes. Never auto-detect fenced block language.
- Add or update `MarkdownBody.test.tsx` for unsafe HTML and fenced-code behavior
  if the markdown renderer changes at all.

## Blame And Commit History Scope

Blame cleanup is part of this pass because the current code fetches and exposes
unfinished behavior on every file route.

Required changes:

- Hide the `Blame` toolbar button in `CodeBrowserPage.tsx`.
- Stop rendering `FileBlamePanel` from the code-browser page.
- Stop automatic `getFileBlame` queries in `useCodeBrowserQueries`.
- Stop refreshing blame in `refreshCodeBrowserData`.
- Stop threading code-browser blame state through
  `src/renderer/src/components/shell/RepositoryRouteSection.tsx`: remove
  `fileBlame`, `fileBlameRangeLimit`, `fileBlameLoading`, `fileBlameError`,
  `onExpandFileBlamePreview`, and `fileBlame.error` from the composed
  `CodeBrowserPage` props/error path when they are no longer used.
- Remove now-unused code-browser blame expansion state from
  `src/renderer/src/hooks/useRepositorySurfaceLimits.ts` and any route-state or
  refresh-action types that only existed to support the active code-browser
  blame preview.
- Remove code-browser-specific blame query-key use from tests, or update tests
  to assert it is not fetched.
- Leave `FileBlamePanel`, `RepoFileBlameResult`, provider methods, and IPC
  routes in place if other work still depends on them. Removing the whole blame
  stack is a separate cleanup.

Keep file commit history in scope:

- The `History` toolbar button and `CommitHistoryPanel` can stay.
- `listCommitsWithStatus` refresh behavior should remain unchanged except for
  tests adjusted around blame removal.

Diff viewing is out of scope for this pass. Do not add a diff viewer while
implementing syntax highlighting.

## Accessibility

- The code viewer remains keyboard-scrollable as a single region; individual
  source lines should not become tab stops.
- Add an accessible label to the source region, for example
  `aria-label="Source for src/main.ts"`.
- Line numbers should be `aria-hidden="true"` so screen readers read source text
  without duplicated numbers.
- When a route line is highlighted, expose it with a concise label or hidden
  marker such as `Highlighted line 42` without repeating it on every line.
- The highlighted line marker must remain present after syntax highlighting
  replaces the plain-text render.
- Highlight/fallback status messages use `role="status"` or `aria-live="polite"`
  and should not steal focus.
- Toolbar buttons keep clear accessible names: `Copy raw`, `Open raw`,
  `Download`, `History`.
- Disabled raw/copy actions need useful `title` text and must be disabled with
  the native `disabled` attribute.
- Preserve visible focus styles inherited from the app shell. Do not hide focus
  outlines inside the code viewer.
- Respect reduced-motion expectations. If adding automatic scroll-to-line, use
  instant scrolling or gate smooth scrolling behind existing app motion policy.

## Styling

Update `src/renderer/src/styles.css` around the existing code-viewer rules:

- Keep `.code-viewer pre` horizontally scrollable with `white-space: pre`.
- Add token classes under a `.code-source-token` namespace or Shiki-compatible
  inline color strategy that can later be themed.
- Keep line numbers tabular and non-selectable.
- Ensure highlighted line background remains visible in both plain and
  highlighted modes.
- Preserve route-line scroll target dimensions across plain and highlighted
  modes so async tokenization does not shift the selected line out of view.
- Add compact styles for highlight skip/failure status in the toolbar or just
  above the code region.
- Large-file and binary fallbacks should use the existing
  `.binary-file-fallback` visual language or a shared neutral fallback class.

Do not redesign the code browser shell in this pass.

## Tests To Add Or Update

Unit tests:

- `codeLanguage.test.ts`
  - explicit filename mapping
  - extension mapping
  - unsupported extension returns null
  - `.mkdn` markdown detection if added
- `codeViewerPolicy.test.ts`
  - binary extension/null-byte handling
  - previewable images are not classified as generic binary files
  - image and markdown path detection
  - highlight threshold decisions
  - large-file threshold decisions
- `codeHighlighter.test.ts` if practical without making tests slow
  - unsupported language bypasses Shiki
  - repository text containing `<script>` is rendered as text by the React token
    path
  - empty lines, whitespace, and trailing newline display remain stable

Renderer tests:

- Update `src/renderer/src/App.test.tsx` or add a focused
  `CodeBrowserPage.test.tsx` for:
  - a supported `.ts` file shows highlighted/tokenized code after async load
    while preserving raw copy
  - route `#L` line highlighting persists before and after async highlighting
  - unsupported file shows plain text and skip status
  - provider `kind: "image"` renders an image preview through `downloadUrl`
  - provider `kind: "binary"` shows binary fallback and disables copy
  - provider `kind: "too_large"` shows large-file fallback and does not render
    line spans
  - markdown file still uses `MarkdownBody`
  - `Blame` button/panel are absent and `getFileBlame` is not called
- Update root markdown coverage in `src/renderer/src/App.test.tsx` or an
  equivalent focused test so `CodeTab` renders root markdown only for
  `kind: "text"` and shows unavailable messaging for non-text
  `RepoFileContent` states.

Provider/shared tests:

- Update `src/main/github/repositoryDomain.test.ts` for:
  - metadata-first file-content fetch
  - too-large file returns `kind: "too_large"` without raw fetch
  - previewable image returns `kind: "image"` without raw fetch
  - binary extension returns `kind: "binary"` without raw fetch
  - metadata succeeds but raw body fetch fails
  - metadata succeeds but last-commit lookup fails
  - `dir`, `symlink`, and `submodule` content items return unavailable states
  - missing `download_url` disables raw actions without failing text preview
  - null-byte content returns `kind: "binary"`
  - invalid or unsupported encoding returns `kind: "unavailable"` with a message
  - normal text file returns `kind: "text"` with content, size, URLs, and
    commit metadata
- Update `src/main/github/octokitProvider.test.ts` for metadata-first request
  sequencing and raw accept-header preservation.
- Update `src/main/ipc/registerControlIpc.test.ts` only if the shared input
  shape changes. Output-only fields should not require parser tests.
- Update shared/mocks/factories wherever `RepoFileContent` is constructed.
- Update `src/renderer/src/components/repository/repositoryTabPrefetch.test.ts`
  for the new `RepoFileContentResult` shape used by root markdown prefetching.

Refresh tests:

- Update `src/renderer/src/hooks/repositoryRefresh.test.ts` so refreshing a
  code-browser file fetches refs, file content, and commits, but not blame.
- Add cache/stale coverage for replacing stale text with successful fresh
  `binary`/`too_large` states, and preserving stale text only when background
  refresh fails.

## Sequencing

1. Add shared preview policy in `src/shared` and extract renderer policy and
   language helpers from `codeBrowserUi.tsx` without changing behavior. Add
   alignment tests.
2. Update `RepoFileContent` in `src/shared/github.ts` and fix all TypeScript
   compile errors in mocks, factories, renderer call sites, root markdown code,
   and provider tests.
3. Change `OctokitRepositoryDomain.getFileContent` to metadata-first loading and
   implement `text`/`image`/`binary`/`too_large`/`unavailable` states.
4. Update `OctokitProvider` tests for JSON metadata requests and raw
   accept-header behavior.
5. Update `CodeBrowserPage.tsx` and `CodeTab.tsx` to consume explicit file
   states and keep markdown/image/plain fallbacks working before adding
   highlighting.
6. Remove code-browser blame UI, automatic blame fetch/refresh behavior, route
   prop threading, and now-unused surface-limit expansion state.
7. Add `CodeSourceView` with plain text rendering, route-line highlighting,
   deterministic optional scroll, large-line-count fallback, copy
   compatibility, and accessibility labels.
8. Add Shiki with `bun add shiki`, verify `package.json`, `bun.lock`, and
   `package-lock.json`, then add lazy highlighting through `codeHighlighter.ts`
   gated by policy and language mapping.
9. Update CSS for token rendering and fallback/status states.
10. Update tests and mocks, then run validation.

Each step should leave the app typecheckable before moving to the next. If the
shared contract change becomes too broad, split after step 4 with plain text
state handling merged before highlighting.

## Acceptance Criteria

- Supported code files under the highlight thresholds render with syntax
  highlighting after an async enhancement pass.
- Plain text appears promptly before the highlighter is ready.
- Route `#L` highlighting remains visible and accessible before and after async
  highlighting. Any auto-scroll to the highlighted line is deterministic,
  reduced-motion-safe, and does not steal focus.
- Unsupported languages render as plain text with a clear non-blocking status.
- Large files do not download or render unbounded content; the app shows a
  predictable large-file fallback with raw actions when possible.
- A successful fresh `too_large`, `image`, `binary`, or `unavailable` result
  replaces any older cached text preview. Stale cached text is preserved only
  for background refresh failures.
- The reverse replacement must work too: a successful fresh `kind: "text"`
  result replaces an older cached `too_large`, `image`, `binary`, or
  `unavailable` state for the same path/ref when the file changes back into a
  previewable text file.
- Previewable images render through `downloadUrl` without being classified as
  generic binary files. If no `downloadUrl` is available, the image preview shows
  a clear unavailable fallback.
- Disabled raw/download/copy actions use native `disabled` attributes and expose
  useful reasons, for example "Raw download URL unavailable for this file type"
  when `downloadUrl` is null.
- Binary files do not render as text and cannot be copied as raw text from the
  viewer.
- Markdown file previews and README/root markdown rendering remain safe and
  formatted.
- Root markdown in `CodeTab` handles the new `RepoFileContent` state shape and
  does not pass `null`/non-text provider states to `MarkdownBody` as if they
  were valid markdown.
- Repository-relative markdown links still route through the existing auditable
  markdown URL path.
- Blame UI is hidden from the code browser, and opening or refreshing a file
  route does not call `getFileBlame` or thread unused blame props through the
  route section.
- File history still loads for file routes.
- Highlighting, large-file policy, file-state rendering, markdown-vs-code
  routing, and blame removal are covered by focused tests.

## Validation

Use repository-defined commands. Do not invoke `vitest` directly.

Focused checks while developing:

```bash
bun run test -- src/renderer/src/components/MarkdownBody.test.tsx
bun run test -- src/renderer/src/components/repository/repositoryTabPrefetch.test.ts
bun run test -- src/renderer/src/App.test.tsx
bun run test -- src/renderer/src/hooks/repositoryRefresh.test.ts
bun run test -- src/main/github/repositoryDomain.test.ts
bun run test -- src/main/github/octokitProvider.test.ts
```

Full required validation before closing implementation work:

```bash
bun run test
bun run format
bun run lint
bun run typecheck
```

For renderer/UI changes, also run the app with `bun run dev` and manually verify
these routes against a repository with small code files, markdown files, images,
unsupported text files, binary files, and a file larger than the preview
threshold.
