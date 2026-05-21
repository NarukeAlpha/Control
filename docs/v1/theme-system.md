# Theme System

Control needs a theme system that keeps the app disciplined while giving users
enough control to avoid a single full-white experience. The target should follow
the Codex app's philosophy: a small number of meaningful theme controls,
predefined themes, and safe customization points rather than unlimited visual
configuration.

## Goals

- Add first-class light and dark mode support.
- Provide a small set of polished predefined themes.
- Let users adjust a few meaningful color choices.
- Keep the app visually coherent across repository, issue, PR, action, and code
  surfaces.
- Avoid one-off component colors that cannot adapt to theme changes.

## Research First

Before implementation, capture reference notes from the Codex app's theme
system:

- available theme presets
- which colors are user-configurable
- how theme controls are grouped in settings
- how dark mode affects surfaces, borders, text, and code blocks
- screenshots of the key settings and app surfaces

The research output should describe the philosophy, not just copy the exact
visual values.

## Theme Model

Control should use explicit design tokens rather than scattered component-level
colors. The first theme model should cover:

- app background
- primary surface
- secondary surface
- elevated surface
- text
- muted text
- border
- accent
- danger
- warning
- success
- focus ring
- code background
- code text

Theme values should flow through CSS variables or the existing design system
mechanism. Components should consume semantic tokens rather than hard-coded
theme-specific values.

## User Controls

The settings UI should expose a small number of choices:

- mode: light, dark, system
- preset theme
- accent color
- surface contrast or density if the design system supports it
- code theme if needed for readable syntax highlighting

Avoid exposing dozens of raw color pickers in the first version. The goal is
customization without making the app easy to visually break.

## Presets

Initial presets should include:

- default light
- default dark
- high contrast dark
- softer light or dim mode

Preset names should describe the experience plainly. Do not use novelty naming
that makes settings harder to scan.

## Implementation Notes

The implementation should start by consolidating current colors into tokens.
Dark mode should not be added by inverting the existing white UI. Each surface
needs intentional contrast, border, hover, focus, and disabled states.

Pay special attention to:

- repository page shell
- code viewer and syntax highlighting
- issue and PR conversation surfaces
- action logs
- settings
- empty and error states

## Out Of Scope

- User-imported theme files.
- Marketplace themes.
- Per-repository themes.
- Full typography or spacing customization.

## Open Questions

- Should theme settings sync across devices later, or remain local-only?
- Should syntax highlighting use a separate selectable theme?
- Should the app expose a high-contrast accessibility mode separately from dark
  mode?
- Which Codex app theme controls should Control intentionally not copy?

## Acceptance Criteria

- Light, dark, and system mode are supported.
- Theme values are represented through shared tokens.
- Core repository surfaces remain readable in every preset.
- Code blocks and logs have intentional dark-mode styling.
- Settings expose a small, coherent set of theme controls.

## Validation

Use screenshots during implementation to verify key surfaces in each preset.

Required validation before closing implementation work:

- `bun run format`
- `bun run lint`
- `bun run typecheck`

Run `bun run test` if theme logic or tested components change.
