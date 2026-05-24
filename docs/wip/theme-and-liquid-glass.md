# Theme And Liquid Glass

The old front-end beta notes mixed fixed typography issues with remaining
Liquid Glass bugs and future theming work. This document is the active WIP plan
for visual system cleanup.

## Current State

- Non-standard font weights from the beta notes have mostly been normalized.
- Critical 10px metadata text has been raised where previously identified.
- The reduced glass setting is wired into renderer class calculation and CSS.
- The app still has Liquid Glass and fallback styling issues.
- There is no full theme system yet.

## Remaining Liquid Glass Work

- Align detail panel border radii with the documented glass panel standard.
- Resolve whether the topbar row should be `50px` or `52px`, then update code
  and docs consistently.
- Restore transparent `.app-shell` behavior when native Liquid Glass is active.
- Restore the documented blue-tinted fallback gradient for
  `body.no-liquid-glass`.
- Fix right-rail corner treatment so it does not fight the rounded app shell.
- Add screenshot verification for native Liquid Glass and fallback modes.

## Theme System Work

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
colors.

## User Controls

Settings should expose a small number of choices:

- mode: light, dark, system
- preset theme
- accent color
- surface contrast or density if the design system supports it
- code theme if needed for readable syntax highlighting

Avoid exposing raw color dictionaries or broad `Record<string, unknown>` theme
payloads across IPC. Theme settings should use constant-derived literal unions
and JSON-serializable shared types.

## Required Work

- Research the Codex app theme system and capture screenshots/notes.
- Consolidate current colors into semantic tokens.
- Add typed shared theme settings.
- Add renderer resolution from settings to CSS variables.
- Add light, dark, system, high-contrast dark, and softer-light or dim presets.
- Update repository, issue, PR, action, code, settings, empty, and error states
  to consume tokens.
- Keep Liquid Glass behavior compatible with native material and fallback mode.

## Acceptance Criteria

- Native Liquid Glass app shell remains transparent where required.
- Fallback mode has the documented visual treatment.
- Right rail and detail panels align with shell geometry.
- Light, dark, and system modes are supported.
- Theme settings are JSON-serializable and validated through shared constants.
- Core repository surfaces remain readable in every preset.
- Code blocks and logs have intentional dark-mode styling.

## Validation

Use screenshots during implementation to verify key surfaces in each preset and
both Liquid Glass modes.

Required before closing implementation work:

```bash
bun run test
bun run format
bun run lint
bun run typecheck
```

Add type-level tests for shared theme settings and IPC compatibility.
