# Wiki Implementation Plan

## Goal

Make Wiki a reliable GitHub-like wiki browser with correct sizing,
independent scroll regions, clear disabled/unavailable states, and safe create,
edit, delete, preview, and external-link behavior.

## Current State

- `WikiTab.tsx` already has page list, selected page preview, copy, create,
  edit, delete, status, and mutation feedback.
- `WikiTab.queries.ts` owns wiki page query behavior and default page limit.
- Route state already includes `wikiPagePath`.
- The source report flags wiki layout and sizing as a specific user concern.

## Primary Files

- `src/renderer/src/components/repository/wiki/WikiTab.tsx`
- `src/renderer/src/components/repository/wiki/WikiTab.queries.ts`
- `src/renderer/src/components/repository/wiki/WikiTab.test.tsx`
- `src/renderer/src/components/MarkdownBody.tsx`
- `src/renderer/src/styles.css`
- `src/main/github/repositoryDomain.ts`
- `src/shared/github.ts`

## Layout Requirements

```text
Repository wiki
├── Header
│   ├── availability
│   ├── wiki feature state
│   └── create/open actions
├── Browser surface
│   ├── Page list/sidebar
│   └── Selected page preview/editor
└── Mutation feedback
```

- Page list scrolls independently.
- Preview scrolls independently.
- Editor scrolls independently.
- Long markdown does not widen the app shell.
- Long code blocks scroll horizontally inside markdown body.
- Tables overflow within markdown body, not the page.
- Images are max-width constrained.
- Page list has stable width.
- Copy feedback does not shift layout.
- Create/edit form has bounded height.
- Long content is clipped within rounded repository surfaces; rounded corners
  should not reveal square background leaks while scrolling.
- Create/edit should use a bounded side panel, modal, or explicit inline editor
  replacement instead of stretching the entire wiki route.
- Editor textarea has sane min and max heights and scrolls internally.

## State Requirements

- Disabled wiki state.
- Empty wiki state.
- Unknown wiki availability.
- GitHub unavailable.
- Cache-only data.
- Selected page not found.
- Selected page loading.
- Selected page unavailable.
- Mutation pending.
- Mutation success.
- Mutation error.

## Interaction Requirements

- Selecting a page updates route state.
- Refresh preserves selected page where possible.
- Deep link to `wikiPagePath` selects or fetches that page.
- Create starts with empty title/content.
- Edit starts from selected page title/content.
- Delete requires confirmation.
- Open external link is labeled `Open wiki page on GitHub` or `Open wiki on GitHub`.
- Provide both selected-page and top-level repository-wiki external links when
  both destinations are meaningful.
- Remove fallback wording.

## Tests

- Disabled wiki renders clean empty state.
- No pages renders clean empty state.
- Selected page route state works.
- Long markdown does not require body overflow if testable.
- Create/edit/delete disabled reasons remain correct.

## Screenshots

- Wiki disabled.
- Empty wiki.
- Page list plus preview.
- Long markdown/code block.
- Edit form.
- Dark theme.

## Acceptance Criteria

- Wiki no longer causes shell overflow.
- Page list and preview are bounded.
- Long markdown is scrollable and clipped within rounded surfaces.
- Markdown content is readable in dark mode.
- Create/edit/delete actions remain safe.
- Disabled and partial unavailable states are clear.
- Required validation passes.
