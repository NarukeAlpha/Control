# Theme And Liquid Glass Foundation

## Goal

Make the visual system enforceable before migrating every feature surface.
Dark theme should be the primary audit mode because it exposes hard-coded
surfaces, weak contrast, inconsistent radii, and mixed visual languages quickly.

## Current State

- `src/renderer/src/styles.css` defines theme presets, glass variables, shell
  backgrounds, surface variables, and many route-specific row classes.
- `src/renderer/src/theme/themeSettings.ts` owns theme mode and preset settings.
- `docs/design/design-system.md` already defines the intended glass shell and
  dense operational layout rules.
- `docs/design/liquid-glass-ui-fixes.md` records prior Liquid Glass fixes and
  byte-order findings.
- `src/main/index.ts` uses `electron-liquid-glass` and currently creates the
  native view with `opaque: true`.
- The source report calls out that `solid` can appear more transparent than
  glass shell, that glass can distort too much, and that the app may not bleed
  through lower windows.

## Primary Files

- `src/renderer/src/styles.css`
- `src/renderer/src/theme/themeSettings.ts`
- `src/renderer/src/theme/themeSettings.test.ts`
- `src/main/index.ts`
- `docs/design/design-system.md`
- `docs/design/liquid-glass-ui-fixes.md`
- Future shared UI primitive files under `src/renderer/src/components/ui` or
  the closest existing local convention.
- Existing shared component files under `src/renderer/src/components/**` that
  should migrate to shared primitives instead of preserving route-local one-off
  styles.

## Audit Commands

Use these as discovery commands, not as blind replacement scripts:

```bash
rg "#[0-9a-fA-F]{3,8}|rgba?\(" src/renderer/src --glob '!styles.css'
rg "border-radius:\s*[0-9]" src/renderer/src
rg "background:\s*(white|black|#[0-9a-fA-F]|rgba?)" src/renderer/src --glob '!styles.css'
rg "box-shadow|backdrop-filter|filter:" src/renderer/src
rg "\.issue-row" src/renderer/src docs
```

## Visual Primitive Work

- Define or consolidate the exact shared primitives named by the source report:
  `Surface`, `Button`, `IconButton`, `ExternalLinkButton`, `FilterBar`,
  `StateSegmentedControl`, `StateChip`, `DetailLayout`, `DetailRail`,
  `Timeline`, `Composer`, and `FormSection`.
- Avoid a primitive layer that is only wrappers around `div`; each primitive
  should encode a real behavior or visual contract.
- Surface hierarchy should include shell, primary panels, dense rows, elevated
  popovers, selected states, danger states, warning states, success states, and
  muted metadata.
- Dense rows should be flat and high contrast; repeated rows should not add
  per-row blur.
- Shell, sidebar, top toolbar, right rail, settings panel, and popovers may use
  glass treatment.
- Do not put UI cards inside other cards.
- Do not make page sections floating cards; page sections should be structured
  surfaces or full-width panels.
- Use stable dimensions for icon buttons, tab rows, list rows, filter controls,
  and segmented controls.

## Token Cleanup

- Promote hard-coded neutral colors into semantic tokens.
- Keep data colors as explicit data colors only when they reflect labels,
  severity, diff status, or user-provided GitHub metadata.
- Avoid locally defined shadows unless they are part of the elevation scale.
- Replace duplicated radii with `--radius-*` variables.
- Remove overuse of `.issue-row` for non-issue rows by introducing semantic row
  classes or shared row primitives.
- Keep selected, hover, focus, disabled, stale, cached, error, warning, success,
  and attention states tokenized.
- Verify dark presets first, then light presets.
- Preserve high-contrast preset readability.

## Liquid Glass Investigation

- Capture before screenshots for current `opaque: true` behavior.
- Test `opaque: false` in a controlled branch.
- Test controlled tint alpha values rather than guessing.
- Test `unstable_setScrim` and `unstable_setSubdued` across light, dark, glass,
  reduced, and solid modes, and in focused and unfocused window states.
- Verify BrowserWindow transparency, root background, body background, and
  `.app-shell` background interactions.
- Verify `body.no-liquid-glass` fallback remains non-macOS scoped.
- Verify `solid`, `reduced`, and `glass-shell` modes are visually distinct.
- Document platform limitations if macOS version or native API behavior blocks
  true below-window bleed-through.

## Required Screenshots

- Full app light solid.
- Full app dark solid.
- Full app dark glass shell.
- Full app dark reduced glass.
- Repository code route dark.
- Repository issues route dark.
- Repository settings route dark.
- Sidebar search state dark.
- Local repository route dark.
- Focused and unfocused macOS window states.

## Tests

- Keep `themeSettings.test.ts` updated if settings semantics change.
- Add utility tests for any shared theme mode/preset mapping changes.
- Add visual screenshot specs only if the route has a reliable fixture.
- Do not add e2e specs without explicit approval; screenshot QA can be manual
  documentation if no test harness exists for it yet.

## Acceptance Criteria

- Dark theme no longer exposes obvious hard-coded light surfaces in core routes.
- Solid, reduced, and glass shell modes behave predictably.
- `solid` does not accidentally appear more transparent than `glass-shell`
  unless deliberately documented as a platform limitation.
- Native glass investigation has before/after notes, not speculative comments.
- Existing rounded shell and panel clipping are preserved.
- Shared visual primitives are ready for Issues and Pull Requests.
- `bun run format`, `bun run lint`, and `bun run typecheck` pass after code work.
