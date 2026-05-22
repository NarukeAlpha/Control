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
- Keep theme settings compatible with Control's strict shared IPC contracts.

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

Theme tokens shared across process boundaries should use explicit flat
interfaces. Do not model shared theme tokens as loose dictionaries such as
`Record<string, string>` or nested `Record<string, unknown>` payloads. If a
token is configurable, name it in the shared type and keep its serialized value
shape stable.

## User Controls

The settings UI should expose a small number of choices:

- mode: light, dark, system
- preset theme
- accent color
- surface contrast or density if the design system supports it
- code theme if needed for readable syntax highlighting

Avoid exposing dozens of raw color pickers in the first version. The goal is
customization without making the app easy to visually break.

Theme settings must be strictly `JsonSerializable` across IPC. Avoid loose
settings payloads such as `Record<string, unknown>`, `unknown`, or optional
opaque `payload` objects. Renderer settings, main-process settings, and shared
settings types should agree on exact fields.

Theme modes, preset names, density choices, and code-theme choices should be
defined from runtime constant arrays:

- define the allowed values with `as const`
- derive the TypeScript literal union from the constant
- use the same constant for validation and UI options

This should match the cleanup-v2 pattern used for GitHub action and route
literal unions instead of introducing unbounded string settings.

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

Settings persistence should keep theme config separate from CSS implementation
details. Store a small typed theme preference object, then resolve it into CSS
variables in the renderer.

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
- Shared theme tokens use explicit interfaces rather than loose dictionaries.
- Theme settings are Json-serializable and validated through constant-derived
  literal unions.
- Core repository surfaces remain readable in every preset.
- Code blocks and logs have intentional dark-mode styling.
- Settings expose a small, coherent set of theme controls.

## Validation

Use screenshots during implementation to verify key surfaces in each preset.
Add type-level tests for shared theme settings and IPC contracts using the
existing `Expect<Equal<...>>` pattern from shared IPC tests. These tests should
prove that renderer-facing theme settings remain compatible with
`JsonSerializable` and do not drift from the shared contract.

Required validation before closing implementation work:

- `bun run test`
- `bun run format`
- `bun run lint`
- `bun run typecheck`
